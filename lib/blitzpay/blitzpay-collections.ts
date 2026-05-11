import "server-only"

import { randomBytes } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getPublicAppOrigin, isOutboundEmailConfigured } from "@/lib/email/config"
import { sendEmail } from "@/lib/email/resend"
import { isValidEmail } from "@/lib/email/format"
import { buildInvoiceCustomerEmailContent } from "@/lib/email/templates"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import { sha256Hex } from "@/lib/portal/token-hash"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { blitzpayReminderDispatchTrigger } from "@/lib/blitzpay/blitzpay-reminder-dispatch-trigger"
import { fetchBlitzpayPaymentIntentsForInvoice } from "@/lib/blitzpay/payment-repository"

export type BlitzpayReminderKind =
  | "before_due"
  | "due_date"
  | "overdue_3"
  | "overdue_7"
  | "overdue_14"
  | "recovery_followup"

function dayDiff(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime()
  const b = new Date(bIso).getTime()
  return Math.floor((a - b) / (1000 * 60 * 60 * 24))
}

function reminderKindForInvoice(inv: {
  due_date: string | null
  status: string
}): BlitzpayReminderKind | null {
  const st = String(inv.status || "").toLowerCase()
  if (st === "paid" || st === "void") return null
  if (!inv.due_date) return null
  const today = new Date().toISOString().slice(0, 10)
  const diff = dayDiff(`${today}T00:00:00Z`, `${inv.due_date}T00:00:00Z`)
  if (diff === -3) return "before_due"
  if (diff === 0) return "due_date"
  if (diff === 3) return "overdue_3"
  if (diff === 7) return "overdue_7"
  if (diff >= 14) return "overdue_14"
  return null
}

function idempotencyKeyForReminder(organizationId: string, invoiceId: string, kind: BlitzpayReminderKind): string {
  return `blitzpay:reminder:v1:${organizationId}:${invoiceId}:${kind}`
}

export async function createBlitzpayPaymentLink(
  admin: SupabaseClient,
  input: {
    organizationId: string
    invoiceId: string
    customerId: string
    createdByUserId: string | null
    expiresAt?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<{ id: string; url: string; token: string }> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.invoiceId, "invoiceId")
  assertUuid(input.customerId, "customerId")
  const token = `bpl_${randomBytes(24).toString("base64url")}`
  const tokenHash = sha256Hex(token)
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from("blitzpay_payment_links")
    .insert({
      organization_id: input.organizationId,
      org_invoice_id: input.invoiceId,
      customer_id: input.customerId,
      created_by_user_id: input.createdByUserId,
      token_hash: tokenHash,
      expires_at: input.expiresAt ?? null,
      metadata: input.metadata ?? {},
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  const url = `${getPublicAppOrigin().replace(/\/+$/, "")}/portal/pay/${encodeURIComponent(token)}`
  return { id, url, token }
}

export async function resolveBlitzpayPaymentLinkToken(
  admin: SupabaseClient,
  token: string,
): Promise<{ ok: true; organizationId: string; invoiceId: string; customerId: string; linkId: string } | { ok: false; reason: string }> {
  const tokenHash = sha256Hex(token.trim())
  const { data, error } = await admin
    .from("blitzpay_payment_links")
    .select("id, organization_id, org_invoice_id, customer_id, status, expires_at, use_count")
    .eq("token_hash", tokenHash)
    .maybeSingle()
  if (error || !data) return { ok: false, reason: "invalid_or_expired" }
  const row = data as {
    id: string
    organization_id: string
    org_invoice_id: string
    customer_id: string
    status: string
    expires_at: string | null
    use_count?: number
  }
  if (row.status !== "active") return { ok: false, reason: "inactive" }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" }
  const { error: upErr } = await admin
    .from("blitzpay_payment_links")
    .update({
      use_count: Math.max(0, Math.round(Number(row.use_count ?? 0))) + 1,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
  if (upErr) throw new Error(upErr.message)
  return {
    ok: true,
    organizationId: row.organization_id,
    invoiceId: row.org_invoice_id,
    customerId: row.customer_id,
    linkId: row.id,
  }
}

async function collectReminderCandidates(admin: SupabaseClient): Promise<Array<{
  organization_id: string
  id: string
  customer_id: string
  invoice_number: string | null
  title: string | null
  due_date: string | null
  status: string
}>> {
  const { data, error } = await admin
    .from("org_invoices")
    .select("organization_id, id, customer_id, invoice_number, title, due_date, status")
    .in("status", ["sent", "overdue", "partial", "pending", "viewed"])
    .order("due_date", { ascending: true })
    .limit(1000)
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{
    organization_id: string
    id: string
    customer_id: string
    invoice_number: string | null
    title: string | null
    due_date: string | null
    status: string
  }>
}

async function reminderSuppressed(
  admin: SupabaseClient,
  organizationId: string,
  invoiceId: string,
  customerId: string,
): Promise<{ suppressed: boolean; reason?: string; email?: string | null; customerName?: string | null }> {
  const [{ data: inv }, { data: cust }, { data: payments }] = await Promise.all([
    admin
      .from("org_invoices")
      .select("status, archived_at")
      .eq("organization_id", organizationId)
      .eq("id", invoiceId)
      .maybeSingle(),
    admin
      .from("customers")
      .select("company_name, billing_email, invoice_delivery_preference, archived_at")
      .eq("organization_id", organizationId)
      .eq("id", customerId)
      .maybeSingle(),
    admin
      .from("org_invoice_payments")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("invoice_id", invoiceId)
      .limit(1),
  ])
  const i = inv as { status?: string; archived_at?: string | null } | null
  const c = cust as {
    company_name?: string | null
    billing_email?: string | null
    invoice_delivery_preference?: string | null
    archived_at?: string | null
  } | null
  if (!i || !c) return { suppressed: true, reason: "missing_invoice_or_customer" }
  if (i.archived_at) return { suppressed: true, reason: "invoice_archived" }
  if ((i.status ?? "").toLowerCase() === "paid" || (payments ?? []).length > 0) return { suppressed: true, reason: "invoice_paid" }
  if ((i.status ?? "").toLowerCase() === "void") return { suppressed: true, reason: "invoice_void" }
  if (c.archived_at) return { suppressed: true, reason: "customer_archived" }
  const pref = String(c.invoice_delivery_preference ?? "").toLowerCase().trim()
  if (pref === "manual" || pref === "mail") return { suppressed: true, reason: "customer_preference" }
  const email = String(c.billing_email ?? "").trim()
  if (!isValidEmail(email)) return { suppressed: true, reason: "missing_customer_email" }
  return { suppressed: false, email, customerName: (c.company_name ?? "").trim() || "Customer" }
}

async function upsertRecoveryCase(
  admin: SupabaseClient,
  input: {
    organizationId: string
    invoiceId: string
    customerId: string
    stage: "monitoring" | "first_reminder" | "second_reminder" | "escalated" | "resolved"
    status: "open" | "paused" | "resolved"
    reason: "failed_payment" | "abandoned_checkout" | "overdue_invoice"
    recommendation: string
    lastAttemptAt?: string | null
    lastAttemptStatus?: string | null
  },
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await admin
    .from("blitzpay_recovery_cases")
    .upsert(
      {
        organization_id: input.organizationId,
        org_invoice_id: input.invoiceId,
        customer_id: input.customerId,
        stage: input.stage,
        status: input.status,
        reason: input.reason,
        recommendation: input.recommendation,
        last_attempt_at: input.lastAttemptAt ?? null,
        last_attempt_status: input.lastAttemptStatus ?? null,
        updated_at: now,
      },
      { onConflict: "organization_id,org_invoice_id" },
    )
  if (error) throw new Error(error.message)
}

async function sendReminderEmail(
  admin: SupabaseClient,
  input: {
    organizationId: string
    invoiceId: string
    customerId: string
    reminderKind: BlitzpayReminderKind
    toEmail: string
    customerName: string
    invoiceNumber: string | null
    invoiceTitle: string | null
  },
): Promise<{ ok: boolean; providerMessageId?: string | null; error?: string }> {
  const [{ data: org }, link] = await Promise.all([
    admin.from("organizations").select("name").eq("id", input.organizationId).maybeSingle(),
    createBlitzpayPaymentLink(admin, {
      organizationId: input.organizationId,
      invoiceId: input.invoiceId,
      customerId: input.customerId,
      createdByUserId: null,
      metadata: { source: "automated_reminder", kind: input.reminderKind },
    }),
  ])
  const orgName = ((org as { name?: string } | null)?.name ?? "").trim() || "Your service team"
  const invoiceLabel = (input.invoiceNumber ?? "").trim() || "Invoice"
  const bodyPlain = `A payment reminder is scheduled for ${invoiceLabel}. Pay securely: ${link.url}`
  const { subject, html, text } = buildInvoiceCustomerEmailContent({
    organizationName: orgName,
    customerName: input.customerName,
    invoiceLabel,
    amountLabel: "",
    dueDateLabel: "",
    issuedDateLabel: "",
    workOrderLabel: null,
    equipmentName: null,
    messagePlain: bodyPlain,
    subjectOverride: `Payment reminder: ${invoiceLabel}`,
    subtotalLabel: null,
    taxLineLabel: null,
    totalLabel: null,
  })
  const htmlWithLink = `${html}<p><a href="${link.url}">Pay securely now</a></p>`
  const send = await sendEmail({
    to: input.toEmail,
    subject,
    html: htmlWithLink,
    text: `${text ?? bodyPlain}\n\nPay securely now: ${link.url}`,
    category: "blitzpay_invoice_payment_reminder",
    organizationId: input.organizationId,
  })
  if (!send.ok) return { ok: false, error: send.error }
  await logCommunicationEvent(admin, {
    organizationId: input.organizationId,
    channel: "email",
    eventType: "invoice_payment_reminder",
    title: `BlitzPay reminder: ${invoiceLabel}`,
    summary: `To ${input.toEmail}`,
    recipientKind: "customer",
    recipientCustomerId: input.customerId,
    recipientAddress: input.toEmail,
    relatedEntityType: "invoice",
    relatedEntityId: input.invoiceId,
    provider: "resend",
    providerMessageId: send.id ?? null,
    deliveryStatus: "sent",
    metadata: { reminder_kind: input.reminderKind, payment_link: link.url },
    sentAt: new Date().toISOString(),
  })
  return { ok: true, providerMessageId: send.id ?? null }
}

export type RunBlitzpayReminderDispatchOptions = {
  /** Count-only path: no reminder rows, no email, no recovery updates. */
  dryRun?: boolean
  /** Platform manual invocation (vs cron). */
  manual?: boolean
}

export async function runBlitzpayReminderDispatch(
  admin: SupabaseClient,
  opts?: RunBlitzpayReminderDispatchOptions,
): Promise<{
  evaluated: number
  sent: number
  skipped: number
  runId: string
  dryRun?: boolean
  simulatedSent?: number
}> {
  const dryRun = Boolean(opts?.dryRun)
  const trigger = blitzpayReminderDispatchTrigger(opts)
  const now = new Date().toISOString()
  const { data: runRow, error: runErr } = await admin
    .from("blitzpay_reminder_runs")
    .insert({ trigger, status: "started", created_at: now })
    .select("id")
    .single()
  if (runErr) throw new Error(runErr.message)
  const runId = (runRow as { id: string }).id

  let evaluated = 0
  let sent = 0
  let skipped = 0
  let simulatedSent = 0
  try {
    const candidates = await collectReminderCandidates(admin)
    const orgIds = [...new Set(candidates.map((c) => c.organization_id))]
    let remindersOnByOrg = new Map<string, boolean>()
    if (orgIds.length > 0) {
      const { data: settingsRows, error: setErr } = await admin
        .from("blitzpay_org_settings")
        .select("organization_id, blitzpay_reminders_enabled")
        .in("organization_id", orgIds)
      if (setErr) throw new Error(setErr.message)
      for (const row of settingsRows ?? []) {
        const r = row as { organization_id: string; blitzpay_reminders_enabled?: boolean }
        remindersOnByOrg.set(r.organization_id, r.blitzpay_reminders_enabled !== false)
      }
    }

    for (const inv of candidates) {
      const kind = reminderKindForInvoice({ due_date: inv.due_date, status: inv.status })
      if (!kind) continue
      if (remindersOnByOrg.get(inv.organization_id) === false) {
        skipped += 1
        continue
      }
      evaluated += 1
      const idempotencyKey = idempotencyKeyForReminder(inv.organization_id, inv.id, kind)
      const suppress = await reminderSuppressed(admin, inv.organization_id, inv.id, inv.customer_id)

      if (dryRun) {
        if (suppress.suppressed) {
          skipped += 1
          continue
        }
        if (!isOutboundEmailConfigured()) {
          skipped += 1
          continue
        }
        simulatedSent += 1
        continue
      }

      const reminderRow = {
        organization_id: inv.organization_id,
        org_invoice_id: inv.id,
        customer_id: inv.customer_id,
        reminder_kind: kind,
        channel: "email",
        scheduled_for: now,
        idempotency_key: idempotencyKey,
        dispatch_status: suppress.suppressed ? "skipped" : "pending",
        skip_reason: suppress.suppressed ? suppress.reason ?? "suppressed" : null,
        updated_at: now,
      }
      const { error: upErr } = await admin
        .from("blitzpay_payment_reminders")
        .upsert(reminderRow, { onConflict: "organization_id,idempotency_key" })
      if (upErr) throw new Error(upErr.message)
      if (suppress.suppressed) {
        skipped += 1
        continue
      }
      if (!isOutboundEmailConfigured()) {
        const { error } = await admin
          .from("blitzpay_payment_reminders")
          .update({ dispatch_status: "skipped", skip_reason: "email_unconfigured", updated_at: now })
          .eq("organization_id", inv.organization_id)
          .eq("idempotency_key", idempotencyKey)
        if (error) throw new Error(error.message)
        skipped += 1
        continue
      }

      const send = await sendReminderEmail(admin, {
        organizationId: inv.organization_id,
        invoiceId: inv.id,
        customerId: inv.customer_id,
        reminderKind: kind,
        toEmail: suppress.email!,
        customerName: suppress.customerName ?? "Customer",
        invoiceNumber: inv.invoice_number,
        invoiceTitle: inv.title,
      })
      if (!send.ok) {
        const { error } = await admin
          .from("blitzpay_payment_reminders")
          .update({
            dispatch_status: "failed",
            skip_reason: send.error ?? "send_failed",
            delivery_status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", inv.organization_id)
          .eq("idempotency_key", idempotencyKey)
        if (error) throw new Error(error.message)
        skipped += 1
      } else {
        const { error } = await admin
          .from("blitzpay_payment_reminders")
          .update({
            dispatch_status: "sent",
            sent_at: new Date().toISOString(),
            delivery_status: "sent",
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", inv.organization_id)
          .eq("idempotency_key", idempotencyKey)
        if (error) throw new Error(error.message)
        sent += 1
      }
      const stage =
        kind === "overdue_14" ? "escalated"
        : kind === "overdue_7" ? "second_reminder"
        : kind === "overdue_3" || kind === "due_date" ? "first_reminder"
        : "monitoring"
      await upsertRecoveryCase(admin, {
        organizationId: inv.organization_id,
        invoiceId: inv.id,
        customerId: inv.customer_id,
        stage,
        status: "open",
        reason: kind.startsWith("overdue") ? "overdue_invoice" : "abandoned_checkout",
        recommendation:
          kind.startsWith("overdue") ?
            "Send payment reminder and include hosted payment link."
          : "Customer is near due date; send hosted payment reminder.",
      })
    }

    const summary = dryRun ? { dry_run: true, simulated_sent: simulatedSent } : {}
    const { error: finErr } = await admin
      .from("blitzpay_reminder_runs")
      .update({
        status: "success",
        reminders_evaluated: evaluated,
        reminders_sent: dryRun ? 0 : sent,
        reminders_skipped: skipped,
        finished_at: new Date().toISOString(),
        summary,
      })
      .eq("id", runId)
    if (finErr) throw new Error(finErr.message)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await admin
      .from("blitzpay_reminder_runs")
      .update({
        status: "failed",
        reminders_evaluated: evaluated,
        reminders_sent: dryRun ? 0 : sent,
        reminders_skipped: skipped,
        error: msg.slice(0, 2000),
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId)
    throw e
  }
  return dryRun ?
      { evaluated, sent: 0, skipped, runId, dryRun: true, simulatedSent }
    : { evaluated, sent, skipped, runId }
}

export async function fetchBlitzpayInvoiceCollectionsView(
  admin: SupabaseClient,
  organizationId: string,
  invoiceId: string,
): Promise<{
  reminders: Array<{
    id: string
    kind: string
    status: string
    channel: string
    scheduledFor: string
    sentAt: string | null
    skipReason: string | null
  }>
  paymentLinks: Array<{
    id: string
    status: string
    createdAt: string
    lastUsedAt: string | null
    useCount: number
  }>
  recoveryCase: {
    stage: string
    status: string
    reason: string
    recommendation: string | null
    lastReminderAt: string | null
    lastAttemptAt: string | null
    lastAttemptStatus: string | null
  } | null
  insights: Array<{ key: string; title: string; detail: string }>
}> {
  assertUuid(organizationId, "organizationId")
  assertUuid(invoiceId, "invoiceId")
  const [{ data: reminders }, { data: links }, { data: recovery }, intents] = await Promise.all([
    admin
      .from("blitzpay_payment_reminders")
      .select("id, reminder_kind, dispatch_status, channel, scheduled_for, sent_at, skip_reason")
      .eq("organization_id", organizationId)
      .eq("org_invoice_id", invoiceId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("blitzpay_payment_links")
      .select("id, status, created_at, last_used_at, use_count")
      .eq("organization_id", organizationId)
      .eq("org_invoice_id", invoiceId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("blitzpay_recovery_cases")
      .select("stage, status, reason, recommendation, last_reminder_at, last_attempt_at, last_attempt_status")
      .eq("organization_id", organizationId)
      .eq("org_invoice_id", invoiceId)
      .maybeSingle(),
    fetchBlitzpayPaymentIntentsForInvoice(admin, organizationId, invoiceId, 50),
  ])

  const remindersOut = (reminders ?? []).map((r) => {
    const row = r as {
      id: string
      reminder_kind: string
      dispatch_status: string
      channel: string
      scheduled_for: string
      sent_at: string | null
      skip_reason: string | null
    }
    return {
      id: row.id,
      kind: row.reminder_kind,
      status: row.dispatch_status,
      channel: row.channel,
      scheduledFor: row.scheduled_for,
      sentAt: row.sent_at,
      skipReason: row.skip_reason,
    }
  })
  const linksOut = (links ?? []).map((r) => {
    const row = r as {
      id: string
      status: string
      created_at: string
      last_used_at: string | null
      use_count: number
    }
    return {
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      useCount: Math.round(Number(row.use_count)),
    }
  })
  const rCase = (recovery as {
    stage: string
    status: string
    reason: string
    recommendation: string | null
    last_reminder_at: string | null
    last_attempt_at: string | null
    last_attempt_status: string | null
  } | null) ?? null

  const piRows = intents as Array<Record<string, unknown>>
  const abandoned = piRows.filter((p) => {
    const st = String(p.status ?? "").toLowerCase()
    return st === "requires_payment_method" || st === "canceled"
  }).length
  const ach = piRows.filter((p) => String(p.payment_method_type ?? "") === "us_bank_account").length
  const card = piRows.filter((p) => String(p.payment_method_type ?? "") === "card").length
  const insights: Array<{ key: string; title: string; detail: string }> = []
  if (abandoned >= 2) {
    insights.push({
      key: "abandoned_checkout_retries",
      title: "Checkout abandonment trend",
      detail: `Customer has ${abandoned} abandoned/unsuccessful checkout attempts. Consider resending a fresh payment link.`,
    })
  }
  if (ach === 0 && card >= 2) {
    insights.push({
      key: "ach_candidate",
      title: "ACH may improve collection likelihood",
      detail: "Customer has card attempts only. Offering ACH in the payment reminder can improve settlement success for larger balances.",
    })
  }
  if ((rCase?.reason ?? "") === "overdue_invoice") {
    insights.push({
      key: "overdue_collection",
      title: "Likely collectible via reminder",
      detail: "Invoice is overdue and in recovery tracking. A targeted follow-up with hosted payment link is recommended.",
    })
  }

  return {
    reminders: remindersOut,
    paymentLinks: linksOut,
    recoveryCase: rCase
      ? {
          stage: rCase.stage,
          status: rCase.status,
          reason: rCase.reason,
          recommendation: rCase.recommendation,
          lastReminderAt: rCase.last_reminder_at,
          lastAttemptAt: rCase.last_attempt_at,
          lastAttemptStatus: rCase.last_attempt_status,
        }
      : null,
    insights,
  }
}

export async function computeBlitzpayCollectionsReporting(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{
  reminderEffectivenessRatePct: number
  averagePaymentDelayDays: number | null
  recoveredRevenueCents: number
  abandonedCheckoutInvoices: number
}> {
  assertUuid(organizationId, "organizationId")
  const [{ data: rem }, { data: invs }, intents] = await Promise.all([
    admin
      .from("blitzpay_payment_reminders")
      .select("dispatch_status")
      .eq("organization_id", organizationId),
    admin
      .from("org_invoices")
      .select("id, due_date, paid_at, status, amount_cents, tax_amount_cents")
      .eq("organization_id", organizationId),
    admin
      .from("blitzpay_payment_intents")
      .select("org_invoice_id, status")
      .eq("organization_id", organizationId),
  ])

  const reminderRows = (rem ?? []) as Array<{ dispatch_status: string }>
  const sent = reminderRows.filter((r) => r.dispatch_status === "sent").length
  const total = reminderRows.length
  const reminderEffectivenessRatePct = total === 0 ? 0 : Math.round((sent / total) * 10000) / 100

  const invoiceRows = (invs ?? []) as Array<{
    id: string
    due_date: string | null
    paid_at: string | null
    status: string
    amount_cents: number
    tax_amount_cents: number | null
  }>
  let delaySum = 0
  let delayCount = 0
  let recoveredRevenueCents = 0
  for (const i of invoiceRows) {
    if (i.due_date && i.paid_at) {
      const d = dayDiff(`${i.paid_at.slice(0, 10)}T00:00:00Z`, `${i.due_date}T00:00:00Z`)
      delaySum += d
      delayCount += 1
      if (d > 0) {
        recoveredRevenueCents += Math.max(0, Math.round(Number(i.amount_cents)) + Math.max(0, Math.round(Number(i.tax_amount_cents ?? 0))))
      }
    }
  }
  const averagePaymentDelayDays = delayCount > 0 ? Math.round((delaySum / delayCount) * 10) / 10 : null

  const iRows = (intents.data ?? []) as Array<{ org_invoice_id: string | null; status: string }>
  const abandonedSet = new Set(
    iRows
      .filter((r) => {
        const st = String(r.status || "").toLowerCase()
        return st === "requires_payment_method" || st === "canceled"
      })
      .map((r) => String(r.org_invoice_id ?? ""))
      .filter((id) => id.length > 0),
  )
  return {
    reminderEffectivenessRatePct,
    averagePaymentDelayDays,
    recoveredRevenueCents,
    abandonedCheckoutInvoices: abandonedSet.size,
  }
}
