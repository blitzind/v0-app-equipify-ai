import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildQuoteEmailContent } from "@/lib/email/templates"
import { isValidEmail } from "@/lib/email/format"
import { parseUuid, requireOrganizationMember } from "@/lib/email/route-auth"
import { quoteStatusUiToDb } from "@/lib/org-quotes-invoices/map"
import type { QuoteStatus } from "@/lib/mock-data"

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

  const { data: row, error: qErr } = await supabase
    .from("org_quotes")
    .select("id, customer_id, equipment_id, quote_number, title, amount_cents, status, expires_at, notes, archived_at")
    .eq("id", quoteId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (qErr || !row || row.archived_at) {
    return NextResponse.json({ error: "not_found", message: "Quote not found." }, { status: 404 })
  }

  const [{ data: org }, { data: cust }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    supabase
      .from("customers")
      .select("company_name")
      .eq("organization_id", organizationId)
      .eq("id", row.customer_id as string)
      .maybeSingle(),
  ])

  const organizationName = (org as { name?: string } | null)?.name?.trim() || "Your service team"
  const customerName = (cust as { company_name?: string } | null)?.company_name?.trim() || "Customer"

  let equipmentLine = ""
  if (row.equipment_id) {
    const { data: eq } = await supabase
      .from("equipment")
      .select("name")
      .eq("organization_id", organizationId)
      .eq("id", row.equipment_id as string)
      .maybeSingle()
    equipmentLine = (eq as { name?: string } | null)?.name?.trim() ? `Equipment: ${(eq as { name: string }).name}` : ""
  }

  const quoteLabel = String(row.quote_number ?? "").trim() || "Quote"
  const amountCents = Number(row.amount_cents ?? 0)
  const amountLabel = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountCents / 100)
  const expRaw = row.expires_at as string | null
  const expiresLabel = expRaw
    ? new Date(expRaw).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—"
  const notes = String(row.notes ?? "").trim()
  const scopeSummary = [equipmentLine, notes ? notes.slice(0, 200) : ""].filter(Boolean).join(" · ") || undefined

  const subjectOverride = typeof body.subject === "string" ? body.subject : undefined
  const messagePlain = typeof body.message === "string" ? body.message : undefined

  const { subject, html, text } = buildQuoteEmailContent({
    organizationName,
    customerName,
    quoteLabel,
    amountLabel,
    expiresLabel,
    scopeSummary,
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
    return NextResponse.json({ error: "send_failed", message: sendResult.error }, { status })
  }

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
        message: `Email may have been delivered but status was not updated: ${upErr.message}`,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, sentAt, emailId: sendResult.id })
}
