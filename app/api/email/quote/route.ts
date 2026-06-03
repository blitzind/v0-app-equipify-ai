import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isValidEmail } from "@/lib/email/format"
import { parseUuid, requireOrganizationMember } from "@/lib/email/route-auth"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { quoteStatusUiToDb } from "@/lib/org-quotes-invoices/map"
import type { QuoteStatus } from "@/lib/mock-data"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import { loadQuoteDocumentContext } from "@/lib/quotes/load-quote-document-context"
import { dispatchCustomerQuoteEmail } from "@/lib/quotes/dispatch-customer-quote-email"

type Body = {
  organizationId?: string
  quoteId?: string
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
  const quoteId = parseUuid(body.quoteId)
  const to = typeof body.to === "string" ? body.to.trim() : ""
  const variant = body.variant === "resend" ? "resend" : "send"

  if (!organizationId || !quoteId) {
    return NextResponse.json({ error: "invalid_payload", message: "organizationId and quoteId are required." }, { status: 400 })
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

  const capGate = await requireOrgPermission(organizationId, "canEditQuotes")
  if ("error" in capGate) return capGate.error

  const docCtx = await loadQuoteDocumentContext(supabase, organizationId, quoteId)
  if (!docCtx) {
    return NextResponse.json({ error: "not_found", message: "Quote not found." }, { status: 404 })
  }

  const messagePlain = typeof body.message === "string" ? body.message : undefined
  const subjectOverride = typeof body.subject === "string" ? body.subject : undefined

  const dispatched = await dispatchCustomerQuoteEmail({
    supabase,
    organizationId,
    quoteId,
    to,
    subjectOverride,
    messagePlain,
    variant,
    documentContext: docCtx,
  })

  if (!dispatched.ok) {
    const status = dispatched.code === "config" ? 503 : 502
    return NextResponse.json({ error: dispatched.code, message: dispatched.message }, { status })
  }

  const sendResult = dispatched.send
  const quoteLabel = docCtx.quoteNumberLabel

  const sentAt = new Date().toISOString()
  const rowPatch: Record<string, unknown> =
    variant === "resend"
      ? { sent_at: sentAt }
      : { status: quoteStatusUiToDb("Sent" as QuoteStatus), sent_at: sentAt }

  const { error: upErr } = await supabase.from("org_quotes").update(rowPatch).eq("id", quoteId).eq("organization_id", organizationId)

  if (upErr) {
    return NextResponse.json(
      {
        error: "persist_failed",
        message: "Email may have been delivered but status was not updated.",
      },
      { status: 500 },
    )
  }

  await logCommunicationEvent(supabase, {
    organizationId,
    channel: "email",
    eventType: "quote_email",
    title: `Quote emailed: ${quoteLabel}`,
    summary: `To ${to}`,
    audience: "both",
    countsTowardUnread: false,
    deliveryStatus: "sent",
    recipientKind: "customer",
    recipientCustomerId: docCtx.customerId,
    recipientAddress: to,
    relatedEntityType: "quote",
    relatedEntityId: quoteId,
    provider: "resend",
    providerMessageId: sendResult.id ?? null,
    sentAt,
    createdBy: user.id,
    metadata: { variant, pdfAttached: dispatched.pdfAttached },
  })

  return NextResponse.json({ ok: true, sentAt, emailId: sendResult.id })
}
