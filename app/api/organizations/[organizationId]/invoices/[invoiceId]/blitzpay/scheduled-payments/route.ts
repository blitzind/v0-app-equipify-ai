import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"
import { createBlitzpayScheduledInvoicePayment } from "@/lib/blitzpay/blitzpay-scheduled-payments"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; invoiceId: string }> },
) {
  const { organizationId, invoiceId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canEditInvoices", "canViewFinancials"])
  if ("error" in gate) return gate.error

  let body: {
    customerId?: string
    scheduledFor?: string
    invoicePortionCents?: number
    scheduleConsentAcknowledged?: boolean
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "POST /api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/scheduled-payments",
  )
  if (drift) return drift

  let customerId = String(body.customerId ?? "").trim()
  if (!UUID_RE.test(customerId)) {
    const { data: inv, error: invErr } = await admin
      .from("org_invoices")
      .select("customer_id")
      .eq("organization_id", organizationId)
      .eq("id", invoiceId)
      .maybeSingle()
    if (invErr || !inv) {
      return NextResponse.json({ error: "invoice_not_found", message: "Invoice not found." }, { status: 404 })
    }
    const cid = String((inv as { customer_id?: string | null }).customer_id ?? "").trim()
    if (!UUID_RE.test(cid)) {
      return NextResponse.json({ error: "bad_request", message: "Invoice has no customer." }, { status: 400 })
    }
    customerId = cid
  }

  const result = await createBlitzpayScheduledInvoicePayment(admin, {
    organizationId,
    orgInvoiceId: invoiceId,
    customerId,
    invoicePortionCents: Math.round(Number(body.invoicePortionCents ?? 0)),
    scheduledForIso: String(body.scheduledFor ?? "").trim(),
    createdByKind: "staff_dashboard",
    staffUserId: gate.userId,
    scheduleConsentAcknowledged: Boolean(body.scheduleConsentAcknowledged),
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true, scheduleId: result.id })
}
