/**
 * AI Ops Phase 5 — send a customer invoice email (payment reminder) from
 * an approved server action. Reuses the same Resend + invoice status
 * update + communication log pattern as `/api/invoices/send-email`, but
 * keeps a slimmer certificate block for operational reminders.
 *
 * **Not autonomous** — only called after an explicit user confirmation
 * in the AI Ops command center.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email/resend"
import { buildInvoiceCustomerEmailContent } from "@/lib/email/templates"
import { isValidEmail } from "@/lib/email/format"
import { invoiceStatusUiToDb } from "@/lib/org-quotes-invoices/map"
import type { InvoiceStatus } from "@/lib/mock-data"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import {
  formatUsdFromCents,
  grandTotalCentsFromInvoiceRow,
  invoiceTaxRowLabel,
} from "@/lib/billing/invoice-financial-display"

export type SendInvoiceReminderResult =
  | { ok: true; sentAt: string; emailId: string | null }
  | { ok: false; code: string; message: string }

export async function sendInvoicePaymentReminderFromAiOps(args: {
  supabase: SupabaseClient
  organizationId: string
  invoiceId: string
  actorUserId: string
  /** Optional override; defaults to `customers.billing_email`. */
  toEmail?: string | null
  /** Friendly reminder copy inserted into the template body. */
  messagePlain?: string
}): Promise<SendInvoiceReminderResult> {
  const { data: invRow, error: invErr } = await args.supabase
    .from("org_invoices")
    .select(
      "id, customer_id, equipment_id, work_order_id, invoice_number, title, amount_cents, tax_amount_cents, tax_rate_percent, status, due_date, issued_at, archived_at",
    )
    .eq("id", args.invoiceId)
    .eq("organization_id", args.organizationId)
    .maybeSingle()

  const inv = invRow as {
    id: string
    customer_id: string
    equipment_id: string | null
    invoice_number?: string
    amount_cents?: number
    status?: string
    due_date?: string | null
    issued_at?: string | null
    archived_at?: string | null
  } | null

  if (invErr || !inv || inv.archived_at) {
    return { ok: false, code: "not_found", message: "Invoice not found." }
  }
  if ((inv.status as string) === "void") {
    return { ok: false, code: "invalid_status", message: "Cannot email a void invoice." }
  }

  const [{ data: org }, { data: cust }, equipRes] = await Promise.all([
    args.supabase.from("organizations").select("name").eq("id", args.organizationId).maybeSingle(),
    args.supabase
      .from("customers")
      .select("company_name, billing_email")
      .eq("organization_id", args.organizationId)
      .eq("id", inv.customer_id)
      .maybeSingle(),
    inv.equipment_id
      ? args.supabase
          .from("equipment")
          .select("name")
          .eq("organization_id", args.organizationId)
          .eq("id", inv.equipment_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const organizationName = (org as { name?: string } | null)?.name?.trim() || "Your service team"
  const customerName =
    (cust as { company_name?: string; billing_email?: string | null } | null)?.company_name?.trim() ||
    "Customer"
  const billingEmail =
    typeof args.toEmail === "string" && args.toEmail.trim()
      ? args.toEmail.trim()
      : ((cust as { billing_email?: string | null } | null)?.billing_email ?? "").trim()

  if (!isValidEmail(billingEmail)) {
    return {
      ok: false,
      code: "no_recipient",
      message: "Add a billing email on the customer record or enter one in the confirmation dialog.",
    }
  }

  const equipmentName =
    equipRes.data && typeof equipRes.data === "object" && "name" in equipRes.data
      ? String((equipRes.data as { name: string }).name).trim() || null
      : null

  const invoiceLabel = String(inv.invoice_number ?? "").trim() || "Invoice"
  const amountCents = Number(inv.amount_cents ?? 0)
  const taxCentsRaw = (inv as { tax_amount_cents?: number | null }).tax_amount_cents
  const taxCents = taxCentsRaw == null ? null : Math.round(Number(taxCentsRaw))
  const grandTotalCents = grandTotalCentsFromInvoiceRow({
    amount_cents: amountCents,
    tax_amount_cents: taxCentsRaw,
  })
  const subtotalLabel = formatUsdFromCents(amountCents)
  const totalLabel = formatUsdFromCents(grandTotalCents)
  const taxRateRaw = (inv as { tax_rate_percent?: number | string | null }).tax_rate_percent
  const taxLineLabel =
    taxCents != null && taxCents > 0 ?
      `${invoiceTaxRowLabel({
        taxRatePercent: taxRateRaw == null ? null : Number(taxRateRaw),
      })}: ${formatUsdFromCents(taxCents)}`
    : null
  const dueRaw = inv.due_date
  const dueDateLabel = dueRaw
    ? new Date(dueRaw + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—"
  const issuedRaw = inv.issued_at
  const issuedDateLabel = issuedRaw
    ? new Date(issuedRaw).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—"

  const reminderBody =
    args.messagePlain?.trim() ||
    `This is a friendly reminder regarding Invoice ${invoiceLabel}. If you have already paid, please disregard this message.`

  const { subject, html, text } = buildInvoiceCustomerEmailContent({
    organizationName,
    customerName,
    invoiceLabel,
    amountLabel: totalLabel,
    dueDateLabel,
    issuedDateLabel,
    workOrderLabel: null,
    equipmentName,
    messagePlain: reminderBody,
    subjectOverride: undefined,
    subtotalLabel: taxLineLabel ? subtotalLabel : null,
    taxLineLabel,
    totalLabel,
  })

  const sendResult = await sendEmail({
    to: billingEmail,
    subject,
    html,
    text,
    category: "invoice_payment_reminder_ai_ops",
    organizationId: args.organizationId,
  })

  if (!sendResult.ok) {
    return { ok: false, code: sendResult.code ?? "send_failed", message: sendResult.error }
  }

  const sentAt = new Date().toISOString()
  const rowPatch: Record<string, unknown> = {
    status: invoiceStatusUiToDb("Sent" as InvoiceStatus),
    sent_at: sentAt,
  }

  const { error: upErr } = await args.supabase
    .from("org_invoices")
    .update(rowPatch)
    .eq("id", args.invoiceId)
    .eq("organization_id", args.organizationId)

  if (upErr) {
    return {
      ok: false,
      code: "persist_failed",
      message: "Email may have been delivered but the invoice status could not be updated.",
    }
  }

  await logCommunicationEvent(args.supabase, {
    organizationId: args.organizationId,
    channel: "email",
    eventType: "invoice_email",
    title: `Invoice emailed: ${invoiceLabel}`,
    summary: `To ${billingEmail}`,
    audience: "both",
    countsTowardUnread: false,
    deliveryStatus: "sent",
    recipientKind: "customer",
    recipientCustomerId: inv.customer_id,
    recipientAddress: billingEmail,
    relatedEntityType: "invoice",
    relatedEntityId: args.invoiceId,
    provider: "resend",
    providerMessageId: sendResult.id ?? null,
    sentAt,
    createdBy: args.actorUserId,
    metadata: { variant: "ai_ops_reminder" },
  })

  return { ok: true, sentAt, emailId: sendResult.id ?? null }
}
