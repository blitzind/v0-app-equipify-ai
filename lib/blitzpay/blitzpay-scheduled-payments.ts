import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createBlitzpayOffSessionInvoicePaymentIntent,
  fetchBlitzpayConnectCustomerDefaultPaymentMethodId,
} from "@/lib/blitzpay/connect-stripe"
import { computeBlitzpayApplicationFeeBreakdown, type BlitzpayFeeInputs } from "@/lib/blitzpay/fees"
import {
  balanceDueCentsForBlitzpay,
  loadInvoiceForBlitzpayPay,
  sumNetRecordedPaymentsCentsForBlitzpay,
} from "@/lib/blitzpay/invoice-pay-eligibility"
import {
  createBlitzpayFeeSnapshot,
  createBlitzpayInvoicePaymentAttempt,
  createBlitzpayPaymentIntentRecord,
  fetchBlitzpayOrgSettingsRow,
  nextBlitzpayInvoicePaymentAttemptNo,
} from "@/lib/blitzpay/payment-repository"
import { blitzpayInvoicePaymentMetadata } from "@/lib/blitzpay/stripe-metadata"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { computeBlitzpayConvenienceFeePreview, DEFAULT_BLITZPAY_DISCLOSURE_COPY } from "@/lib/blitzpay/convenience-fees"
import type { BlitzpayPaymentMethodType } from "@/lib/blitzpay/payment-domain"
import { DEFAULT_BLITZPAY_FEE_POLICY_VERSION } from "@/lib/blitzpay/payment-domain"
import { buildScheduledExecutionStripeIdempotencyKey, effectivePartialPaymentsEnabled } from "@/lib/blitzpay/blitzpay-phase2k-partial-math"
import { logCommunicationEvent } from "@/lib/notifications/log-event"

function convenienceSettingsFromRow(settings: Record<string, unknown>) {
  const disclosure =
    typeof settings.blitzpay_fee_disclosure_copy === "string" && settings.blitzpay_fee_disclosure_copy.trim().length > 0
      ? settings.blitzpay_fee_disclosure_copy.trim()
      : DEFAULT_BLITZPAY_DISCLOSURE_COPY
  return {
    passProcessingFeesToCustomer: Boolean(settings.blitzpay_pass_processing_fees_to_customer),
    feeMode:
      typeof settings.blitzpay_fee_mode === "string" &&
      (settings.blitzpay_fee_mode === "customer_pass_through" ||
        settings.blitzpay_fee_mode === "customer_partial_pass_through")
        ? settings.blitzpay_fee_mode
        : "merchant_absorbs" as const,
    feePercentageSnapshot: Math.max(0, Number(settings.blitzpay_fee_percentage_snapshot ?? 0)),
    feeCapCents:
      settings.blitzpay_fee_cap_cents == null ? null : Math.max(0, Math.round(Number(settings.blitzpay_fee_cap_cents))),
    disclosureCopy: disclosure,
  }
}

async function appendTimeline(
  admin: SupabaseClient,
  input: {
    organizationId: string
    orgInvoiceId: string
    eventType:
      | "scheduled_payment_created"
      | "scheduled_payment_failed"
      | "scheduled_payment_cancelled"
      | "autopay_consent_recorded"
    details: Record<string, unknown>
  },
): Promise<void> {
  await admin.from("blitzpay_collections_timeline").insert({
    organization_id: input.organizationId,
    org_invoice_id: input.orgInvoiceId,
    event_type: input.eventType,
    actor_kind: "system",
    details: input.details,
  })
}

async function notifyScheduledFailure(
  admin: SupabaseClient,
  organizationId: string,
  invoiceId: string,
  customerId: string,
  message: string,
): Promise<void> {
  await admin.from("blitzpay_recovery_cases").upsert(
    {
      organization_id: organizationId,
      org_invoice_id: invoiceId,
      customer_id: customerId,
      stage: "escalated",
      status: "open",
      reason: "failed_payment",
      recommendation: "A scheduled BlitzPay payment failed. Contact the customer or send a fresh payment link.",
      metadata: { source: "scheduled_payment", last_error: message.slice(0, 500) },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,org_invoice_id" },
  )
  await logCommunicationEvent(admin, {
    organizationId,
    channel: "system",
    eventType: "workflow_automation",
    title: "BlitzPay scheduled payment failed",
    summary: message.slice(0, 220),
    audience: "organization",
    countsTowardUnread: true,
    deliveryStatus: "sent",
    recipientKind: "external",
    recipientCustomerId: customerId,
    relatedEntityType: "invoice",
    relatedEntityId: invoiceId,
    metadata: { blitzpay_scheduled_payment: true, automation_id: "blitzpay_scheduled_pay" },
  })
}

export type CreateBlitzpayScheduledInvoicePaymentInput = {
  organizationId: string
  orgInvoiceId: string
  customerId: string
  invoicePortionCents: number
  scheduledForIso: string
  createdByKind: "customer_portal" | "staff_dashboard"
  portalUserId?: string | null
  staffUserId?: string | null
  scheduleConsentAcknowledged: boolean
}

export async function createBlitzpayScheduledInvoicePayment(
  admin: SupabaseClient,
  input: CreateBlitzpayScheduledInvoicePaymentInput,
): Promise<{ ok: true; id: string } | { ok: false; code: string; message: string }> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.orgInvoiceId, "orgInvoiceId")
  assertUuid(input.customerId, "customerId")
  if (!input.scheduleConsentAcknowledged) {
    return { ok: false, code: "consent_required", message: "Confirm scheduled payment terms before continuing." }
  }
  const when = Date.parse(input.scheduledForIso)
  if (!Number.isFinite(when)) {
    return { ok: false, code: "bad_schedule_time", message: "Invalid schedule time." }
  }
  const minLead = 60 * 60 * 1000
  if (when < Date.now() + minLead) {
    return { ok: false, code: "schedule_too_soon", message: "Schedule at least one hour in the future." }
  }

  const settings = await fetchBlitzpayOrgSettingsRow(admin, input.organizationId)
  if (!settings || !(settings as { blitzpay_invoice_pay_enabled?: boolean }).blitzpay_invoice_pay_enabled) {
    return { ok: false, code: "org_pay_disabled", message: "BlitzPay is not enabled for this workspace." }
  }
  if ((settings as { blitzpay_scheduled_payments_enabled?: boolean }).blitzpay_scheduled_payments_enabled === false) {
    return { ok: false, code: "scheduling_disabled", message: "Scheduled payments are disabled for this workspace." }
  }

  const inv = await loadInvoiceForBlitzpayPay(admin, input.organizationId, input.orgInvoiceId)
  if (!inv || inv.customer_id !== input.customerId) {
    return { ok: false, code: "invoice_not_found", message: "Invoice not found." }
  }
  const paidSum = await sumNetRecordedPaymentsCentsForBlitzpay(admin, input.organizationId, input.orgInvoiceId)
  const balanceDue = balanceDueCentsForBlitzpay(inv, paidSum)
  const partialEff = effectivePartialPaymentsEnabled({
    orgPartialEnabled: Boolean((settings as { blitzpay_partial_payments_enabled?: boolean }).blitzpay_partial_payments_enabled),
    platformPartialAllowed: (settings as { blitzpay_platform_partial_payments_allowed?: boolean }).blitzpay_platform_partial_payments_allowed !== false,
    minPortionCents: Math.max(50, Math.round(Number((settings as { blitzpay_partial_payment_min_cents?: number }).blitzpay_partial_payment_min_cents ?? 50))),
  })
  const portion = Math.round(input.invoicePortionCents)
  if (portion < 50 || portion > balanceDue) {
    return { ok: false, code: "invalid_amount", message: "Scheduled amount is out of range for this invoice." }
  }
  if (portion < balanceDue && !partialEff) {
    return { ok: false, code: "partial_not_allowed", message: "Partial scheduled payments are not enabled." }
  }

  const { data: profile } = await admin
    .from("blitzpay_customer_payment_profiles")
    .select("off_session_authorized, autopay_authorization_status, stripe_customer_id")
    .eq("organization_id", input.organizationId)
    .eq("customer_id", input.customerId)
    .maybeSingle()
  const pr = profile as {
    off_session_authorized?: boolean
    autopay_authorization_status?: string
    stripe_customer_id?: string | null
  } | null
  if (!pr?.stripe_customer_id?.trim()) {
    return { ok: false, code: "no_saved_profile", message: "Save a payment method on file before scheduling a payment." }
  }
  if (!pr.off_session_authorized || pr.autopay_authorization_status !== "active") {
    return { ok: false, code: "autopay_not_authorized", message: "Future payment authorization is not active for this account." }
  }

  const scheduleId = randomUUID()
  const executionKey = `blitzpay:schedule_exec:v1:${scheduleId}`
  const now = new Date().toISOString()
  const { error } = await admin.from("blitzpay_scheduled_invoice_payments").insert({
    id: scheduleId,
    organization_id: input.organizationId,
    org_invoice_id: input.orgInvoiceId,
    customer_id: input.customerId,
    invoice_portion_cents: portion,
    scheduled_for: new Date(when).toISOString(),
    status: "pending",
    execution_idempotency_key: executionKey,
    created_by_kind: input.createdByKind,
    portal_user_id: input.portalUserId ?? null,
    created_by_user_id: input.staffUserId ?? null,
    schedule_consent_acknowledged: true,
    metadata: { created_at_client: input.scheduledForIso },
    created_at: now,
    updated_at: now,
  })
  if (error) {
    return { ok: false, code: "insert_failed", message: error.message }
  }
  await appendTimeline(admin, {
    organizationId: input.organizationId,
    orgInvoiceId: input.orgInvoiceId,
    eventType: "scheduled_payment_created",
    details: { schedule_id: scheduleId, portion_cents: portion, scheduled_for: new Date(when).toISOString() },
  })
  return { ok: true, id: scheduleId }
}

export async function cancelBlitzpayScheduledInvoicePayment(
  admin: SupabaseClient,
  organizationId: string,
  orgInvoiceId: string,
  scheduleId: string,
  actorUserId: string | null,
  reason: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  assertUuid(organizationId, "organizationId")
  assertUuid(orgInvoiceId, "orgInvoiceId")
  assertUuid(scheduleId, "scheduleId")
  const { data: row, error: selErr } = await admin
    .from("blitzpay_scheduled_invoice_payments")
    .select("id, org_invoice_id, status")
    .eq("organization_id", organizationId)
    .eq("org_invoice_id", orgInvoiceId)
    .eq("id", scheduleId)
    .maybeSingle()
  if (selErr || !row) return { ok: false, code: "not_found", message: "Scheduled payment not found." }
  const st = String((row as { status: string }).status)
  if (st !== "pending") {
    return { ok: false, code: "not_cancellable", message: "Only pending schedules can be cancelled." }
  }
  const now = new Date().toISOString()
  const { error } = await admin
    .from("blitzpay_scheduled_invoice_payments")
    .update({
      status: "cancelled",
      cancelled_at: now,
      cancel_reason: reason.slice(0, 500),
      updated_at: now,
    })
    .eq("id", scheduleId)
    .eq("organization_id", organizationId)
    .eq("org_invoice_id", orgInvoiceId)
    .eq("status", "pending")
  if (error) return { ok: false, code: "update_failed", message: error.message }
  await appendTimeline(admin, {
    organizationId,
    orgInvoiceId: String((row as { org_invoice_id: string }).org_invoice_id),
    eventType: "scheduled_payment_cancelled",
    details: { schedule_id: scheduleId, actor_user_id: actorUserId, reason: reason.slice(0, 200) },
  })
  return { ok: true }
}

export async function runBlitzpayScheduledPaymentsDue(admin: SupabaseClient): Promise<{
  processed: number
  failed: number
}> {
  const nowIso = new Date().toISOString()
  const { data: due, error } = await admin
    .from("blitzpay_scheduled_invoice_payments")
    .select(
      "id, organization_id, org_invoice_id, customer_id, invoice_portion_cents, execution_idempotency_key, status, created_by_kind",
    )
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(25)
  if (error) throw new Error(error.message)

  let processed = 0
  let failed = 0
  for (const raw of due ?? []) {
    const row = raw as {
      id: string
      organization_id: string
      org_invoice_id: string
      customer_id: string
      invoice_portion_cents: number
      execution_idempotency_key: string
      created_by_kind: string
    }
    const { data: locked, error: lockErr } = await admin
      .from("blitzpay_scheduled_invoice_payments")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("organization_id", row.organization_id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle()
    if (lockErr || !locked) continue

    try {
      await executeOneScheduledPayment(admin, row)
      processed += 1
    } catch (e) {
      failed += 1
      const msg = e instanceof Error ? e.message : String(e)
      await admin
        .from("blitzpay_scheduled_invoice_payments")
        .update({
          status: "failed",
          last_error: msg.slice(0, 2000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("organization_id", row.organization_id)
      await appendTimeline(admin, {
        organizationId: row.organization_id,
        orgInvoiceId: row.org_invoice_id,
        eventType: "scheduled_payment_failed",
        details: { schedule_id: row.id, error: msg.slice(0, 500) },
      })
      await notifyScheduledFailure(admin, row.organization_id, row.org_invoice_id, row.customer_id, msg)
    }
  }
  return { processed, failed }
}

async function executeOneScheduledPayment(
  admin: SupabaseClient,
  row: {
    id: string
    organization_id: string
    org_invoice_id: string
    customer_id: string
    invoice_portion_cents: number
    execution_idempotency_key: string
    created_by_kind: string
  },
): Promise<void> {
  const settings = await fetchBlitzpayOrgSettingsRow(admin, row.organization_id)
  if (!settings || (settings as { blitzpay_scheduled_payments_enabled?: boolean }).blitzpay_scheduled_payments_enabled === false) {
    throw new Error("Scheduled payments disabled.")
  }
  const inv = await loadInvoiceForBlitzpayPay(admin, row.organization_id, row.org_invoice_id)
  if (!inv) throw new Error("Invoice not found.")
  const paidSum = await sumNetRecordedPaymentsCentsForBlitzpay(admin, row.organization_id, row.org_invoice_id)
  const balanceDue = balanceDueCentsForBlitzpay(inv, paidSum)
  if (balanceDue < 50) throw new Error("No balance due.")
  const portion = Math.min(Math.round(row.invoice_portion_cents), balanceDue)
  if (portion < 50) throw new Error("Scheduled portion below minimum.")

  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .select("stripe_connect_account_id, stripe_charges_enabled")
    .eq("id", row.organization_id)
    .maybeSingle()
  if (orgErr || !orgRow) throw new Error("Organization not found.")
  const acct = String((orgRow as { stripe_connect_account_id?: string | null }).stripe_connect_account_id ?? "").trim()
  if (!acct || !(orgRow as { stripe_charges_enabled?: boolean }).stripe_charges_enabled) {
    throw new Error("Connect not ready.")
  }

  const { data: profile, error: pErr } = await admin
    .from("blitzpay_customer_payment_profiles")
    .select(
      "stripe_customer_id, off_session_authorized, autopay_authorization_status, autopay_authorized_method_type",
    )
    .eq("organization_id", row.organization_id)
    .eq("customer_id", row.customer_id)
    .maybeSingle()
  if (pErr || !profile) throw new Error("No payment profile.")
  const pr = profile as {
    stripe_customer_id?: string | null
    off_session_authorized?: boolean
    autopay_authorization_status?: string
    autopay_authorized_method_type?: string | null
  }
  const custId = String(pr.stripe_customer_id ?? "").trim()
  if (!custId) throw new Error("Missing Stripe customer on profile.")
  if (!pr.off_session_authorized || pr.autopay_authorization_status !== "active") {
    throw new Error("Autopay authorization inactive.")
  }

  const pmId = await fetchBlitzpayConnectCustomerDefaultPaymentMethodId({
    stripeConnectAccountId: acct,
    stripeCustomerId: custId,
  })
  if (!pmId) throw new Error("No default payment method on file with Stripe.")

  const methodType: BlitzpayPaymentMethodType =
    pr.autopay_authorized_method_type === "us_bank_account" ? "us_bank_account" : "card"
  const conveniencePreview = computeBlitzpayConvenienceFeePreview({
    invoiceBalanceCents: portion,
    settings: convenienceSettingsFromRow(settings as Record<string, unknown>),
    paymentMethodType: methodType,
    achConvenienceFeeEnabled: Boolean((settings as { blitzpay_ach_convenience_fee_enabled?: boolean }).blitzpay_ach_convenience_fee_enabled),
  })
  const s = settings as { platform_fee_bps: number; platform_fee_fixed_cents: number }
  const feeInputs: BlitzpayFeeInputs = {
    amountCents: BigInt(conveniencePreview.totalChargeCents),
    platformFeeBps: Math.max(0, Math.min(10_000, Number(s.platform_fee_bps) || 0)),
    platformFeeFixedCents: Math.max(0, Number(s.platform_fee_fixed_cents) || 0),
    convenienceFeeBps: 0,
    convenienceFeeFixedCents: 0,
  }
  const breakdown = computeBlitzpayApplicationFeeBreakdown(feeInputs)
  const applicationFeeCents = Number(breakdown.computedTotalApplicationFeeCents)
  const feeVersion = DEFAULT_BLITZPAY_FEE_POLICY_VERSION
  const paySrc = row.created_by_kind === "staff_dashboard" ? "staff_dashboard" : "customer_portal"
  const meta = blitzpayInvoicePaymentMetadata({
    organizationId: row.organization_id,
    orgInvoiceId: row.org_invoice_id,
    feePolicyVersion: feeVersion,
    paymentSource: paySrc,
    scheduledPaymentId: row.id,
  })

  const stripeIdem = buildScheduledExecutionStripeIdempotencyKey(row.id)
  const pi = await createBlitzpayOffSessionInvoicePaymentIntent({
    stripeConnectAccountId: acct,
    stripeCustomerId: custId,
    stripePaymentMethodId: pmId,
    amountCents: conveniencePreview.totalChargeCents,
    applicationFeeCents,
    currency: "usd",
    metadata: meta,
    idempotencyKey: stripeIdem,
  })

  const internalPiId = randomUUID()
  const attemptNo = await nextBlitzpayInvoicePaymentAttemptNo(admin, row.organization_id, row.org_invoice_id)

  await createBlitzpayPaymentIntentRecord(admin, {
    id: internalPiId,
    organizationId: row.organization_id,
    stripeConnectAccountId: acct,
    stripePaymentIntentId: pi.id,
    stripeCheckoutSessionId: null,
    status: pi.status,
    amountCents: BigInt(portion),
    currency: "usd",
    applicationFeeCents: breakdown.computedTotalApplicationFeeCents,
    convenienceFeeCents: BigInt(conveniencePreview.convenienceFeeCents),
    invoiceAmountCents: BigInt(portion),
    orgInvoiceId: row.org_invoice_id,
    customerId: row.customer_id,
    idempotencyKey: `blitzpay:scheduled_row_pi:v1:${row.id}`,
    metadata: { ...meta, execution: "scheduled_off_session" },
    paymentMethodType: methodType,
    stripeCustomerId: custId,
    savePaymentMethodRequested: false,
  })

  await createBlitzpayFeeSnapshot(admin, {
    organizationId: row.organization_id,
    blitzpayPaymentIntentId: internalPiId,
    feeInputs,
  })

  await createBlitzpayInvoicePaymentAttempt(admin, {
    organizationId: row.organization_id,
    orgInvoiceId: row.org_invoice_id,
    blitzpayPaymentIntentId: internalPiId,
    attemptNo,
    channel: "scheduled_off_session",
    createdByUserId: null,
    portalAccessContext: { scheduled_payment_id: row.id },
    status: pi.status === "succeeded" ? "redirected" : "initiated",
  })

  await admin
    .from("blitzpay_scheduled_invoice_payments")
    .update({
      blitzpay_payment_intent_id: internalPiId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("organization_id", row.organization_id)

  if (
    pi.status !== "succeeded" &&
    pi.status !== "processing" &&
    pi.status !== "requires_action" &&
    pi.status !== "requires_confirmation"
  ) {
    throw new Error(pi.last_payment_error?.message || `PaymentIntent status ${pi.status}`)
  }
}
