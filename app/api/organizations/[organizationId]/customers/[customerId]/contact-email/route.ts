import { NextResponse } from "next/server"
import { parseUuid } from "@/lib/email/route-auth"
import { isValidEmail } from "@/lib/email/format"
import { sendEmail } from "@/lib/email/resend"
import { buildCustomerStaffMessageEmailContent } from "@/lib/email/templates"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import { normalizeEmail as normalizeCanonicalEmail } from "@/lib/growth/import/normalize"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function logCustomerContactEmail(payload: Record<string, unknown>) {
  try {
    console.info(JSON.stringify({ source: "customer-contact-email", ...payload }))
  } catch {
    /* best-effort */
  }
}

function normalizeEmail(e: string): string {
  return normalizeCanonicalEmail(e) ?? e.trim().toLowerCase()
}

/**
 * Sends a staff-authored email to an address that belongs to the customer
 * (billing email or a non-archived contact). Uses centralized `sendEmail()`.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; customerId: string }> },
) {
  const { organizationId: orgRaw, customerId: custRaw } = await context.params
  const organizationId = parseUuid(orgRaw)
  const customerId = parseUuid(custRaw)
  if (!organizationId || !customerId || !UUID_RE.test(organizationId) || !UUID_RE.test(customerId)) {
    return NextResponse.json({ error: "invalid_ids", message: "Invalid organization or customer id." }, { status: 400 })
  }

  let body: { to?: string; subject?: string; message?: string; contactId?: string | null }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 })
  }

  const toRaw = typeof body.to === "string" ? body.to : ""
  const to = normalizeEmail(toRaw)
  const subjectIn = typeof body.subject === "string" ? body.subject.trim() : ""
  const message = typeof body.message === "string" ? body.message.trim() : ""
  const contactId =
    typeof body.contactId === "string" && UUID_RE.test(body.contactId) ? body.contactId : null

  if (!isValidEmail(to)) {
    logCustomerContactEmail({
      organizationId,
      customerId,
      outcome: "blocked",
      reason: "invalid_recipient",
    })
    return NextResponse.json(
      { error: "invalid_recipient", message: "Enter a valid recipient email address." },
      { status: 400 },
    )
  }
  if (subjectIn.length < 2 || subjectIn.length > 300) {
    return NextResponse.json(
      { error: "invalid_subject", message: "Subject must be between 2 and 300 characters." },
      { status: 400 },
    )
  }
  if (message.length < 1 || message.length > 12_000) {
    return NextResponse.json(
      { error: "invalid_message", message: "Message must be between 1 and 12000 characters." },
      { status: 400 },
    )
  }

  const gate = await requireAnyOrgPermission(organizationId, [
    "canManageCommunications",
    "canEditWorkOrders",
    "canEditInvoices",
  ])
  if ("error" in gate) return gate.error

  const { supabase, userId } = gate

  const { data: cust, error: custErr } = await supabase
    .from("customers")
    .select("id, company_name, billing_email")
    .eq("id", customerId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (custErr || !cust) {
    return NextResponse.json({ error: "not_found", message: "Customer not found." }, { status: 404 })
  }

  const companyName = String((cust as { company_name?: string }).company_name ?? "").trim() || "Customer"
  const billingEmail = normalizeEmail(String((cust as { billing_email?: string | null }).billing_email ?? ""))

  const { data: contactRows, error: ctErr } = await supabase
    .from("customer_contacts")
    .select("id, email")
    .eq("customer_id", customerId)
    .eq("organization_id", organizationId)
    .is("archived_at", null)

  if (ctErr) {
    return NextResponse.json({ error: "query_failed", message: ctErr.message }, { status: 500 })
  }

  const contactEmails = new Set<string>()
  for (const row of contactRows ?? []) {
    const em = normalizeEmail(String((row as { email?: string | null }).email ?? ""))
    if (isValidEmail(em)) contactEmails.add(em)
  }
  if (isValidEmail(billingEmail)) contactEmails.add(billingEmail)

  if (contactEmails.size === 0) {
    logCustomerContactEmail({
      organizationId,
      customerId,
      outcome: "blocked",
      reason: "no_recipients_on_file",
    })
    return NextResponse.json(
      {
        error: "no_customer_email",
        message: "This customer has no billing email or contact emails on file. Add one before sending.",
      },
      { status: 400 },
    )
  }

  if (!contactEmails.has(to)) {
    logCustomerContactEmail({
      organizationId,
      customerId,
      outcome: "blocked",
      reason: "recipient_not_allowed",
    })
    return NextResponse.json(
      {
        error: "recipient_not_allowed",
        message: "Recipient must match this customer’s billing email or an active contact email.",
      },
      { status: 400 },
    )
  }

  if (contactId) {
    const { data: cRow, error: oneErr } = await supabase
      .from("customer_contacts")
      .select("id")
      .eq("id", contactId)
      .eq("customer_id", customerId)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .maybeSingle()
    if (oneErr || !cRow) {
      return NextResponse.json({ error: "invalid_contact", message: "Contact does not belong to this customer." }, { status: 400 })
    }
  }

  const { data: orgRow } = await supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle()
  const organizationName = String((orgRow as { name?: string } | null)?.name ?? "").trim() || "Your service team"

  const { subject, html, text } = buildCustomerStaffMessageEmailContent({
    organizationName,
    customerName: companyName,
    messagePlain: message,
    subject: subjectIn,
  })

  const sendResult = await sendEmail({
    to,
    subject,
    html,
    text,
    category: "customer_staff_message",
    organizationId,
  })

  if (!sendResult.ok) {
    const status = sendResult.code === "config" ? 503 : 502
    logCustomerContactEmail({
      organizationId,
      customerId,
      contactId,
      outcome: "failed",
      category: "customer_staff_message",
      code: sendResult.code ?? "provider",
    })
    return NextResponse.json({ error: "send_failed", message: sendResult.error }, { status })
  }

  const sentAt = new Date().toISOString()
  await logCommunicationEvent(supabase, {
    organizationId,
    channel: "email",
    eventType: "customer_staff_email",
    title: subject.slice(0, 200),
    summary: `To ${to}`,
    body: null,
    audience: "both",
    countsTowardUnread: false,
    deliveryStatus: "sent",
    recipientKind: "customer",
    recipientCustomerId: customerId,
    recipientAddress: to,
    relatedEntityType: "customer",
    relatedEntityId: customerId,
    provider: "resend",
    providerMessageId: sendResult.id ?? null,
    sentAt,
    createdBy: userId,
    metadata: {
      category: "customer_staff_message",
      ...(contactId ? { contact_id: contactId } : {}),
    },
  })

  logCustomerContactEmail({
    organizationId,
    customerId,
    contactId,
    outcome: "sent",
    category: "customer_staff_message",
    providerMessageId: sendResult.id ?? null,
  })

  return NextResponse.json({ ok: true, sentAt, emailId: sendResult.id ?? null })
}
