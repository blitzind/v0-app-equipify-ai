import { NextResponse } from "next/server"
import { requireAnyOrgPermissionFromRequest } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"
import { createBlitzpayPaymentLink } from "@/lib/blitzpay/blitzpay-collections"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string; invoiceId: string }> },
) {
  const { organizationId, invoiceId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermissionFromRequest(request, organizationId, [
    "canEditInvoices",
    "canViewFinancials",
  ])
  if ("error" in gate) return gate.error
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "GET /api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/payment-link",
  )
  if (drift) return drift
  const { data, error } = await admin
    .from("blitzpay_payment_links")
    .select("id, status, created_at, last_used_at, use_count")
    .eq("organization_id", organizationId)
    .eq("org_invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .limit(25)
  if (error) return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 })
  return NextResponse.json({ links: data ?? [] })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; invoiceId: string }> },
) {
  const { organizationId, invoiceId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermissionFromRequest(request, organizationId, [
    "canEditInvoices",
    "canViewFinancials",
  ])
  if ("error" in gate) return gate.error
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "POST /api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/payment-link",
  )
  if (drift) return drift

  const { data: inv, error: invErr } = await admin
    .from("org_invoices")
    .select("customer_id")
    .eq("organization_id", organizationId)
    .eq("id", invoiceId)
    .maybeSingle()
  if (invErr || !inv) {
    return NextResponse.json({ error: "invoice_not_found", message: "Invoice not found." }, { status: 404 })
  }
  const customerId = String((inv as { customer_id?: string | null }).customer_id ?? "")
  if (!UUID_RE.test(customerId)) {
    return NextResponse.json({ error: "missing_customer", message: "Invoice has no customer for payment link." }, { status: 409 })
  }
  try {
    const created = await createBlitzpayPaymentLink(admin, {
      organizationId,
      invoiceId,
      customerId,
      createdByUserId: gate.userId,
      metadata: { source: "staff_manual" },
    })
    return NextResponse.json({
      ok: true,
      link: { id: created.id, url: created.url },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message: msg }, { status: 500 })
  }
}
