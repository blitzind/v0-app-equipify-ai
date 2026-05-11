import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { createBlitzpayPaymentLink } from "@/lib/blitzpay/blitzpay-collections"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"
import { assertInvoiceLinkedToWorkOrder } from "@/lib/blitzpay/work-order-invoice-link"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; workOrderId: string; invoiceId: string }> },
) {
  const { organizationId, workOrderId, invoiceId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(workOrderId) || !UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, [
    "canViewFinancials",
    "canAssistBlitzpayCollection",
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
    "POST /api/organizations/.../work-orders/.../blitzpay/invoices/.../collect/payment-link",
  )
  if (drift) return drift

  const linked = await assertInvoiceLinkedToWorkOrder(admin, organizationId, invoiceId, workOrderId)
  if (!linked) {
    return NextResponse.json({ error: "not_linked", message: "Invoice is not linked to this work order." }, { status: 409 })
  }

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
      metadata: { source: "work_order_collect", work_order_id: workOrderId },
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
