import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"
import { createBlitzpayPaymentLink } from "@/lib/blitzpay/blitzpay-collections"
import { updateBlitzpayPaymentLinkStatus } from "@/lib/blitzpay/blitzpay-payment-link-controls"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; invoiceId: string; linkId: string }> },
) {
  const { organizationId, invoiceId, linkId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(invoiceId) || !UUID_RE.test(linkId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canEditInvoices"])
  if ("error" in gate) return gate.error

  let body: { action?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 })
  }
  const action = String(body.action ?? "").trim().toLowerCase()
  if (action !== "revoke" && action !== "expire" && action !== "regenerate") {
    return NextResponse.json({ error: "bad_request", message: "action must be revoke, expire, or regenerate." }, { status: 400 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "POST /api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/payment-links/[linkId]",
  )
  if (drift) return drift

  if (action === "revoke") {
    const res = await updateBlitzpayPaymentLinkStatus(admin, {
      organizationId,
      invoiceId,
      linkId,
      action: "revoke",
      actorUserId: gate.userId,
    })
    if (!res.ok) return NextResponse.json({ error: res.code, message: res.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }
  if (action === "expire") {
    const res = await updateBlitzpayPaymentLinkStatus(admin, {
      organizationId,
      invoiceId,
      linkId,
      action: "expire",
      actorUserId: gate.userId,
    })
    if (!res.ok) return NextResponse.json({ error: res.code, message: res.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  const exp = await updateBlitzpayPaymentLinkStatus(admin, {
    organizationId,
    invoiceId,
    linkId,
    action: "expire",
    actorUserId: gate.userId,
  })
  if (!exp.ok) return NextResponse.json({ error: exp.code, message: exp.message }, { status: 400 })

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
    return NextResponse.json({ error: "missing_customer", message: "Invoice has no customer." }, { status: 409 })
  }
  try {
    const created = await createBlitzpayPaymentLink(admin, {
      organizationId,
      invoiceId,
      customerId,
      createdByUserId: gate.userId,
      metadata: { source: "staff_regenerate", superseded_link_id: linkId },
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
