import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildInvoiceEmailContent } from "@/lib/email/templates"
import { isValidEmail } from "@/lib/email/format"
import { parseUuid, requireOrganizationMember } from "@/lib/email/route-auth"
import { invoiceStatusUiToDb } from "@/lib/org-quotes-invoices/map"
import type { InvoiceStatus } from "@/lib/mock-data"

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

  const { data: inv, error: invErr } = await supabase
    .from("org_invoices")
    .select(
      "id, customer_id, equipment_id, invoice_number, title, amount_cents, status, due_date, issued_at, archived_at",
    )
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (invErr || !inv || inv.archived_at) {
    return NextResponse.json({ error: "not_found", message: "Invoice not found." }, { status: 404 })
  }

  if ((inv.status as string) === "void") {
    return NextResponse.json({ error: "invalid_status", message: "Cannot email a void invoice." }, { status: 400 })
  }

  const [{ data: org }, { data: cust }, { data: equip }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    supabase
      .from("customers")
      .select("company_name")
      .eq("organization_id", organizationId)
      .eq("id", inv.customer_id as string)
      .maybeSingle(),
    inv.equipment_id ?
      supabase
        .from("equipment")
        .select("name")
        .eq("organization_id", organizationId)
        .eq("id", inv.equipment_id as string)
        .maybeSingle()
    : Promise.resolve({ data: null }),
  ])

  const organizationName = (org as { name?: string } | null)?.name?.trim() || "Your service team"
  const customerName = (cust as { company_name?: string } | null)?.company_name?.trim() || "Customer"
  const equipmentSummary =
    equip && typeof equip === "object" && "name" in equip && typeof (equip as { name: string }).name === "string"
      ? `Equipment: ${(equip as { name: string }).name}`
      : undefined

  const invoiceLabel = String((inv as { invoice_number?: string }).invoice_number ?? "").trim() || "Invoice"
  const amountCents = Number((inv as { amount_cents?: number }).amount_cents ?? 0)
  const amountLabel = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountCents / 100)
  const dueRaw = (inv as { due_date?: string | null }).due_date
  const dueDateLabel = dueRaw
    ? new Date(dueRaw + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—"
  const issuedRaw = (inv as { issued_at?: string | null }).issued_at
  const issuedDateLabel = issuedRaw
    ? new Date(issuedRaw).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—"

  const subjectOverride = typeof body.subject === "string" ? body.subject : undefined
  const messagePlain = typeof body.message === "string" ? body.message : undefined

  const { subject, html, text } = buildInvoiceEmailContent({
    organizationName,
    customerName,
    invoiceLabel,
    amountLabel,
    dueDateLabel,
    issuedDateLabel,
    equipmentSummary,
    messagePlain,
    subjectOverride,
  })

  const sendResult = await sendEmail({
    to,
    subject,
    html,
    text,
  })

  if (!sendResult.ok) {
    const status = sendResult.code === "config" ? 503 : 502
    return NextResponse.json(
      { error: "send_failed", message: sendResult.error },
      { status },
    )
  }

  const sentAt = new Date().toISOString()
  const rowPatch: Record<string, unknown> =
    variant === "resend"
      ? { sent_at: sentAt }
      : { status: invoiceStatusUiToDb("Sent" as InvoiceStatus), sent_at: sentAt }

  const { error: upErr } = await supabase.from("org_invoices").update(rowPatch).eq("id", invoiceId).eq("organization_id", organizationId)

  if (upErr) {
    return NextResponse.json(
      {
        error: "persist_failed",
        message: `Email may have been delivered but status was not updated: ${upErr.message}`,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, sentAt, emailId: sendResult.id })
}
