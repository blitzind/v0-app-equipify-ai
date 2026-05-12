import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { invoiceStatusDbToUi } from "@/lib/org-quotes-invoices/map"
import { rankCustomerMatches } from "@/lib/aiden/actions/resolvers/create-invoice-from-work-order-resolver"
import type {
  DraftCustomerMessagePreviewPayload,
  DraftCustomerMessageScenario,
} from "@/lib/aiden/actions/resolvers/draft-customer-message-types"

export type { DraftCustomerMessagePreviewPayload, DraftCustomerMessageScenario } from "@/lib/aiden/actions/resolvers/draft-customer-message-types"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ResolveDraftCustomerMessageInput = {
  organizationId: string
  userId: string
  invoiceId?: string
  workOrderId?: string
  quoteId?: string
  equipmentId?: string
  customerId?: string
  paymentLinkUrl?: string
  customerReference?: string
  /** Normalized user text for light keyword hints (no LLM). */
  intentNormalized?: string
}

export type ResolveDraftCustomerMessageResult =
  | { status: "prepared"; preview: DraftCustomerMessagePreviewPayload }
  | {
      status: "needs_clarification"
      reason: string
      customerCandidates: Array<{ id: string; label: string }>
    }
  | { status: "failed"; reason: string }

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function fmtShortDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function isSafePaymentLinkUrl(raw: string): boolean {
  const t = raw.trim()
  if (t.length < 12 || t.length > 2048) return false
  if (!/^https:\/\//i.test(t)) return false
  try {
    const u = new URL(t)
    if (u.protocol !== "https:") return false
    if (!u.hostname || u.hostname === "localhost") return false
    return true
  } catch {
    return false
  }
}

async function loadActiveCustomers(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ rows: CustomerRow[]; error?: string }> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, company_name, billing_name")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .eq("is_archived", false)
    .limit(2500)

  if (error) return { rows: [], error: error.message }
  return { rows: (data ?? []) as Array<{ id: string; company_name: string; billing_name: string | null }> }
}

function invoiceLooksOverdue(row: { status: string; due_date: string | null }): boolean {
  if (row.status === "overdue") return true
  if (row.status === "unpaid" || row.status === "sent") {
    if (!row.due_date) return false
    const due = new Date(`${row.due_date}T23:59:59.999Z`)
    return due.getTime() < Date.now()
  }
  return false
}

function buildTemplates(args: {
  scenario: DraftCustomerMessageScenario
  customerName: string
  invoiceNumber?: string
  invoiceTitle?: string
  invoiceStatusUi?: string
  amountCents?: number
  dueDate?: string | null
  issuedAt?: string | null
  quoteNumber?: string
  quoteTitle?: string
  quoteStatus?: string
  woNumber?: number | null
  woTitle?: string
  woCompletedAt?: string | null
  equipmentName?: string
  nextDueAt?: string | null
  paymentLinkUrl?: string | null
}): { subject: string; body: string } {
  const { scenario, customerName } = args
  const greet = `Hello,\n\n`

  switch (scenario) {
    case "payment_link": {
      const inv = args.invoiceNumber ? `#${args.invoiceNumber}` : "your invoice"
      const amt =
        args.amountCents != null ? ` The amount due is ${fmtMoney(args.amountCents)}.` : ""
      const link = args.paymentLinkUrl?.trim()
      const linkBlock =
        link ?
          `\nYou can review and pay securely online using this link:\n${link}\n`
        : "\nWe will send a secure payment link separately.\n"
      return {
        subject: args.invoiceTitle ? `Payment — ${args.invoiceTitle}` : `Payment request — ${inv}`,
        body: `${greet}Thank you for working with us. This message is regarding ${inv} for ${customerName}.${amt}${linkBlock}\nIf you have any questions, just reply to this thread.\n\nThank you,\nYour service team`,
      }
    }
    case "overdue_invoice": {
      const inv = args.invoiceNumber ? `#${args.invoiceNumber}` : "your invoice"
      const due = args.dueDate ? fmtShortDate(args.dueDate) : null
      const amt = args.amountCents != null ? fmtMoney(args.amountCents) : "the open balance"
      return {
        subject: `Friendly reminder — ${inv} (${customerName})`,
        body: `${greet}We are reaching out about ${inv}, which ${due ? `had a due date of ${due} and ` : ""}currently shows an open balance of ${amt}.\n\nIf you have already sent payment, thank you — please disregard this note. Otherwise, let us know if you need a copy of the invoice or want to arrange payment.\n\nThank you,\nYour service team`,
      }
    }
    case "invoice": {
      const inv = args.invoiceNumber ? `#${args.invoiceNumber}` : "your invoice"
      const st = args.invoiceStatusUi ? ` (${args.invoiceStatusUi})` : ""
      const amt = args.amountCents != null ? ` Balance shown: ${fmtMoney(args.amountCents)}.` : ""
      return {
        subject: args.invoiceTitle ? `Invoice update — ${args.invoiceTitle}` : `Invoice ${inv}${st}`,
        body: `${greet}We wanted to share an update regarding ${inv} for ${customerName}.${amt}\n\nPlease let us know if you have any questions.\n\nThank you,\nYour service team`,
      }
    }
    case "quote_follow_up": {
      const qn = args.quoteNumber ? `#${args.quoteNumber}` : "your estimate"
      const st = args.quoteStatus ? ` Status: ${args.quoteStatus}.` : ""
      const amt = args.amountCents != null ? ` Amount: ${fmtMoney(args.amountCents)}.` : ""
      return {
        subject: args.quoteTitle ? `Following up — ${args.quoteTitle}` : `Following up — ${qn}`,
        body: `${greet}We are following up on ${qn} for ${customerName}.${st}${amt}\n\nWe would be glad to answer questions or adjust the scope if helpful.\n\nThank you,\nYour service team`,
      }
    }
    case "work_order_completion": {
      const wo =
        args.woNumber != null ? `work order #${args.woNumber}` : "your recent work order"
      const title = args.woTitle ? ` (“${args.woTitle}”)` : ""
      const done = args.woCompletedAt ? ` Completed: ${fmtShortDate(args.woCompletedAt)}.` : ""
      return {
        subject: `Thank you — ${wo} for ${customerName}`,
        body: `${greet}Thank you for choosing us for ${wo}${title}.${done}\n\nWe appreciate your business. If anything comes up, we are here to help.\n\nThank you,\nYour service team`,
      }
    }
    case "maintenance_reminder": {
      const eq = args.equipmentName ? args.equipmentName : "your equipment"
      const nd = args.nextDueAt ? fmtShortDate(args.nextDueAt) : null
      const dueLine = nd ? ` Based on our records, the next suggested service window is around ${nd}.` : ""
      return {
        subject: `Maintenance reminder — ${eq}`,
        body: `${greet}This is a friendly reminder about scheduled care for ${eq} on your account (${customerName}).${dueLine}\n\nReply whenever you would like to book a visit.\n\nThank you,\nYour service team`,
      }
    }
    case "customer_follow_up":
    default:
      return {
        subject: `Following up — ${customerName}`,
        body: `${greet}We are checking in to see if there is anything we can help with for ${customerName}.\n\nThank you,\nYour service team`,
      }
  }
}

/**
 * Deterministic customer-facing copy for staff review only. Does not send email/SMS.
 */
export async function resolveDraftCustomerMessagePreview(
  userSupabase: SupabaseClient,
  input: ResolveDraftCustomerMessageInput,
): Promise<ResolveDraftCustomerMessageResult> {
  const orgId = input.organizationId.trim()
  if (!UUID_RE.test(orgId)) {
    return { status: "failed", reason: "Invalid organization id." }
  }

  const payUrlRaw = input.paymentLinkUrl?.trim()
  const payUrl = payUrlRaw && isSafePaymentLinkUrl(payUrlRaw) ? payUrlRaw : undefined

  const intent = (input.intentNormalized ?? "").trim()

  const invoiceId = input.invoiceId?.trim()
  const quoteId = input.quoteId?.trim()
  const workOrderId = input.workOrderId?.trim()
  const equipmentId = input.equipmentId?.trim()
  let customerId = input.customerId?.trim()

  const warnings: string[] = []

  if (payUrl && (!invoiceId || !UUID_RE.test(invoiceId))) {
    return {
      status: "failed",
      reason: "A message with a payment link needs an open invoice in context plus a valid https checkout URL.",
    }
  }

  if (quoteId && UUID_RE.test(quoteId)) {
    const { data: q, error } = await userSupabase
      .from("org_quotes")
      .select("id, customer_id, quote_number, title, amount_cents, status, archived_at")
      .eq("organization_id", orgId)
      .eq("id", quoteId)
      .maybeSingle()
    if (error) return { status: "failed", reason: error.message }
    if (!q || q.archived_at) return { status: "failed", reason: "Quote was not found or is archived." }
    const { data: cust } = await userSupabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", orgId)
      .eq("id", q.customer_id)
      .maybeSingle()
    if (!cust) return { status: "failed", reason: "Customer for this quote was not found." }
    const { subject, body } = buildTemplates({
      scenario: "quote_follow_up",
      customerName: cust.company_name,
      quoteNumber: String(q.quote_number ?? ""),
      quoteTitle: String(q.title ?? ""),
      quoteStatus: String(q.status ?? ""),
      amountCents: Math.round(Number(q.amount_cents) || 0),
    })
    return {
      status: "prepared",
      preview: {
        scenario: "quote_follow_up",
        customer: { id: cust.id, companyName: cust.company_name },
        recordSummary: `Quote #${q.quote_number} — ${q.title}`,
        amountLine: fmtMoney(Math.round(Number(q.amount_cents) || 0)),
        statusLine: String(q.status ?? ""),
        dateLine: null,
        paymentLinkUrl: null,
        subject,
        body,
        relatedEntityType: "quote",
        relatedEntityId: q.id,
        warnings,
      },
    }
  }

  if (invoiceId && UUID_RE.test(invoiceId)) {
    const { data: inv, error } = await userSupabase
      .from("org_invoices")
      .select(
        "id, customer_id, invoice_number, title, status, amount_cents, due_date, issued_at, archived_at",
      )
      .eq("organization_id", orgId)
      .eq("id", invoiceId)
      .maybeSingle()
    if (error) return { status: "failed", reason: error.message }
    if (!inv || inv.archived_at) return { status: "failed", reason: "Invoice was not found or is archived." }

    const overdue = invoiceLooksOverdue({
      status: String(inv.status ?? ""),
      due_date: inv.due_date as string | null,
    })
    const forceOverdue = /\boverdue\b/.test(intent)
    const effectiveScenario: DraftCustomerMessageScenario =
      payUrl ? "payment_link" : overdue || forceOverdue ? "overdue_invoice" : "invoice"

    const { data: cust } = await userSupabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", orgId)
      .eq("id", inv.customer_id)
      .maybeSingle()
    if (!cust) return { status: "failed", reason: "Customer for this invoice was not found." }

    const statusUi = invoiceStatusDbToUi(String(inv.status ?? ""))
    const { subject, body } = buildTemplates({
      scenario: effectiveScenario,
      customerName: cust.company_name,
      invoiceNumber: String(inv.invoice_number ?? ""),
      invoiceTitle: String(inv.title ?? ""),
      invoiceStatusUi: String(statusUi),
      amountCents: Math.round(Number(inv.amount_cents) || 0),
      dueDate: inv.due_date as string | null,
      issuedAt: inv.issued_at as string | null,
      paymentLinkUrl: payUrl ?? null,
    })

    return {
      status: "prepared",
      preview: {
        scenario: effectiveScenario,
        customer: { id: cust.id, companyName: cust.company_name },
        recordSummary: `Invoice #${inv.invoice_number} — ${inv.title}`,
        amountLine: fmtMoney(Math.round(Number(inv.amount_cents) || 0)),
        statusLine: String(statusUi),
        dateLine: fmtShortDate(inv.due_date as string | null) ?? fmtShortDate(inv.issued_at as string | null),
        paymentLinkUrl: payUrl ?? null,
        subject,
        body,
        relatedEntityType: "invoice",
        relatedEntityId: inv.id,
        warnings,
      },
    }
  }

  if (workOrderId && UUID_RE.test(workOrderId)) {
    const { data: wo, error } = await userSupabase
      .from("work_orders")
      .select("id, customer_id, work_order_number, title, status, completed_at")
      .eq("organization_id", orgId)
      .eq("id", workOrderId)
      .maybeSingle()
    if (error) return { status: "failed", reason: error.message }
    if (!wo) return { status: "failed", reason: "Work order was not found." }
    const { data: cust } = await userSupabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", orgId)
      .eq("id", wo.customer_id)
      .maybeSingle()
    if (!cust) return { status: "failed", reason: "Customer for this work order was not found." }
    const { subject, body } = buildTemplates({
      scenario: "work_order_completion",
      customerName: cust.company_name,
      woNumber: wo.work_order_number as number | null,
      woTitle: String(wo.title ?? ""),
      woCompletedAt: wo.completed_at as string | null,
    })
    return {
      status: "prepared",
      preview: {
        scenario: "work_order_completion",
        customer: { id: cust.id, companyName: cust.company_name },
        recordSummary: `Work order #${wo.work_order_number ?? "—"} — ${wo.title}`,
        amountLine: null,
        statusLine: String(wo.status ?? ""),
        dateLine: fmtShortDate(wo.completed_at as string | null),
        paymentLinkUrl: null,
        subject,
        body,
        relatedEntityType: "work_order",
        relatedEntityId: wo.id,
        warnings,
      },
    }
  }

  if (equipmentId && UUID_RE.test(equipmentId)) {
    const { data: eq, error } = await userSupabase
      .from("equipment")
      .select("id, customer_id, name, next_due_at")
      .eq("organization_id", orgId)
      .eq("id", equipmentId)
      .maybeSingle()
    if (error) return { status: "failed", reason: error.message }
    if (!eq) return { status: "failed", reason: "Equipment was not found." }
    const { data: cust } = await userSupabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", orgId)
      .eq("id", eq.customer_id)
      .maybeSingle()
    if (!cust) return { status: "failed", reason: "Customer for this equipment was not found." }
    const { subject, body } = buildTemplates({
      scenario: "maintenance_reminder",
      customerName: cust.company_name,
      equipmentName: String(eq.name ?? "Equipment"),
      nextDueAt: eq.next_due_at as string | null,
    })
    return {
      status: "prepared",
      preview: {
        scenario: "maintenance_reminder",
        customer: { id: cust.id, companyName: cust.company_name },
        recordSummary: `${eq.name}`,
        amountLine: null,
        statusLine: null,
        dateLine: fmtShortDate(eq.next_due_at as string | null),
        paymentLinkUrl: null,
        subject,
        body,
        relatedEntityType: "equipment",
        relatedEntityId: eq.id,
        warnings,
      },
    }
  }

  if (!customerId || !UUID_RE.test(customerId)) {
    const ref = input.customerReference?.trim()
    if (!ref) {
      return {
        status: "failed",
        reason:
          "Open an invoice, quote, work order, equipment, or customer page (or add a customer name) so AIden can draft a grounded message.",
      }
    }
    const { rows, error } = await loadActiveCustomers(userSupabase, orgId)
    if (error) return { status: "failed", reason: error }
    const ranked = rankCustomerMatches(ref, rows)
    if (ranked.length === 0) {
      return {
        status: "needs_clarification",
        reason: "No customer matched that name closely enough.",
        customerCandidates: [],
      }
    }
    if (ranked.length > 1 && ranked[0].score < 92) {
      return {
        status: "needs_clarification",
        reason: "Multiple customers could match — pick one in the UI or open their profile.",
        customerCandidates: ranked.slice(0, 8).map((r) => ({ id: r.id, label: r.label })),
      }
    }
    customerId = ranked[0].id
  }
  const { data: cust, error: cErr } = await userSupabase
    .from("customers")
    .select("id, company_name")
    .eq("organization_id", orgId)
    .eq("id", customerId)
    .maybeSingle()
  if (cErr) return { status: "failed", reason: cErr.message }
  if (!cust) return { status: "failed", reason: "Customer was not found." }

  const { subject, body } = buildTemplates({
    scenario: "customer_follow_up",
    customerName: cust.company_name,
  })

  return {
    status: "prepared",
    preview: {
      scenario: "customer_follow_up",
      customer: { id: cust.id, companyName: cust.company_name },
      recordSummary: "General follow-up",
      amountLine: null,
      statusLine: null,
      dateLine: null,
      paymentLinkUrl: null,
      subject,
      body,
      relatedEntityType: "customer",
      relatedEntityId: cust.id,
      warnings,
    },
  }
}
