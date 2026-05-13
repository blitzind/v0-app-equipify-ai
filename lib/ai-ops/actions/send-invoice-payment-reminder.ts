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
import { isValidEmail } from "@/lib/email/format"
import { invoiceStatusUiToDb } from "@/lib/org-quotes-invoices/map"
import type { InvoiceStatus } from "@/lib/mock-data"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import { loadInvoiceDocumentContext } from "@/lib/invoices/load-invoice-document-context"
import { dispatchCustomerInvoiceEmail } from "@/lib/invoices/dispatch-customer-invoice-email"

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
    .select("id, customer_id, archived_at, status")
    .eq("id", args.invoiceId)
    .eq("organization_id", args.organizationId)
    .maybeSingle()

  const inv = invRow as {
    id: string
    customer_id: string
    archived_at: string | null
    status?: string
  } | null

  if (invErr || !inv || inv.archived_at) {
    return { ok: false, code: "not_found", message: "Invoice not found." }
  }
  if ((inv.status as string) === "void") {
    return { ok: false, code: "invalid_status", message: "Cannot email a void invoice." }
  }

  const { data: cust } = await args.supabase
    .from("customers")
    .select("company_name, billing_email")
    .eq("organization_id", args.organizationId)
    .eq("id", inv.customer_id)
    .maybeSingle()

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

  const docCtx = await loadInvoiceDocumentContext(args.supabase, args.organizationId, args.invoiceId)
  if (!docCtx) {
    return { ok: false, code: "not_found", message: "Invoice not found." }
  }

  const invoiceLabel = docCtx.invoiceNumberLabel
  const reminderBody =
    args.messagePlain?.trim() ||
    `This is a friendly reminder regarding invoice ${invoiceLabel}. If you have already paid, please disregard this message.`

  const dispatched = await dispatchCustomerInvoiceEmail({
    supabase: args.supabase,
    organizationId: args.organizationId,
    invoiceId: args.invoiceId,
    to: billingEmail,
    messagePlain: reminderBody,
    variant: "reminder",
    blitzpayStaffUserId: args.actorUserId,
    documentContext: docCtx,
    resendCategory: "invoice_payment_reminder_ai_ops",
  })

  if (!dispatched.ok) {
    return { ok: false, code: dispatched.code, message: dispatched.message }
  }

  const sendResult = dispatched.send

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
    metadata: { variant: "ai_ops_reminder", pdfAttached: dispatched.pdfAttached },
  })

  return { ok: true, sentAt, emailId: sendResult.id ?? null }
}
