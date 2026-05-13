import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isValidEmail } from "@/lib/email/format"
import { parseUuid, requireOrganizationMember } from "@/lib/email/route-auth"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { invoiceStatusUiToDb } from "@/lib/org-quotes-invoices/map"
import type { InvoiceStatus } from "@/lib/mock-data"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import { loadInvoiceDocumentContext } from "@/lib/invoices/load-invoice-document-context"
import { dispatchCustomerInvoiceEmail } from "@/lib/invoices/dispatch-customer-invoice-email"

type Body = {
  organizationId?: string
  invoiceId?: string
  to?: string
  subject?: string
  message?: string
  variant?: "send" | "resend"
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 })
  }

  const organizationId = parseUuid(body.organizationId)
  const invoiceId = parseUuid(body.invoiceId)
  const to = typeof body.to === "string" ? body.to.trim() : ""
  const variant = body.variant === "resend" ? "resend" : "send"

  if (!organizationId || !invoiceId) {
    return NextResponse.json({ error: "invalid_payload", message: "organizationId and invoiceId are required." }, { status: 400 })
  }
  if (!isValidEmail(to)) {
    return NextResponse.json({ error: "invalid_recipient", message: "Enter a valid recipient email address." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to send email." }, { status: 401 })
  }

  const allowed = await requireOrganizationMember(supabase, user.id, organizationId)
  if (!allowed) {
    return NextResponse.json({ error: "forbidden", message: "You do not have access to this organization." }, { status: 403 })
  }

  const capGate = await requireOrgPermission(organizationId, "canEditInvoices")
  if ("error" in capGate) return capGate.error

  const docCtx = await loadInvoiceDocumentContext(supabase, organizationId, invoiceId)
  if (!docCtx) {
    return NextResponse.json({ error: "not_found", message: "Invoice not found." }, { status: 404 })
  }

  const messagePlain = typeof body.message === "string" ? body.message : undefined
  const subjectOverride = typeof body.subject === "string" ? body.subject : undefined

  const dispatched = await dispatchCustomerInvoiceEmail({
    supabase,
    organizationId,
    invoiceId,
    to,
    subjectOverride,
    messagePlain,
    variant,
    blitzpayStaffUserId: user.id,
    documentContext: docCtx,
    resendCategory: "invoice_customer_legacy_route",
  })

  if (!dispatched.ok) {
    const status = dispatched.code === "config" ? 503 : 502
    return NextResponse.json({ error: dispatched.code, message: dispatched.message }, { status })
  }

  const sendResult = dispatched.send
  const invoiceLabel = docCtx.invoiceNumberLabel

  const sentAt = new Date().toISOString()
  const rowPatch: Record<string, unknown> =
    variant === "resend"
      ? { sent_at: sentAt }
      : { status: invoiceStatusUiToDb("Sent" as InvoiceStatus), sent_at: sentAt }

  const { error: upErr } = await supabase
    .from("org_invoices")
    .update(rowPatch)
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)

  if (upErr) {
    return NextResponse.json(
      {
        error: "persist_failed",
        message: `Email may have been delivered but status was not updated: ${upErr.message}`,
      },
      { status: 500 },
    )
  }

  await logCommunicationEvent(supabase, {
    organizationId,
    channel: "email",
    eventType: "invoice_email",
    title: `Invoice emailed: ${invoiceLabel}`,
    summary: `To ${to}`,
    audience: "both",
    countsTowardUnread: false,
    deliveryStatus: "sent",
    recipientKind: "customer",
    recipientCustomerId: docCtx.customerId,
    recipientAddress: to,
    relatedEntityType: "invoice",
    relatedEntityId: invoiceId,
    provider: "resend",
    providerMessageId: sendResult.id ?? null,
    sentAt,
    createdBy: user.id,
    metadata: { variant, route: "legacy_email_invoice", pdfAttached: dispatched.pdfAttached },
  })

  return NextResponse.json({ ok: true, sentAt, emailId: sendResult.id })
}
