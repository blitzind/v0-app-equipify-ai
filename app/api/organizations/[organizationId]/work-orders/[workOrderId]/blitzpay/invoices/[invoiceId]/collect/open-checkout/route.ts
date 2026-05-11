import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { prepareBlitzpayInvoiceHostedCheckout } from "@/lib/blitzpay/blitzpay-prepare-invoice-pay"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"
import { assertInvoiceLinkedToWorkOrder } from "@/lib/blitzpay/work-order-invoice-link"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
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
    "POST /api/organizations/.../work-orders/.../blitzpay/invoices/.../collect/open-checkout",
  )
  if (drift) return drift

  const linked = await assertInvoiceLinkedToWorkOrder(admin, organizationId, invoiceId, workOrderId)
  if (!linked) {
    return NextResponse.json({ error: "not_linked", message: "Invoice is not linked to this work order." }, { status: 409 })
  }

  let preferredPaymentMethodType: "card" | "us_bank_account" | undefined
  try {
    const body = (await request.json()) as { paymentMethodType?: string }
    if (body.paymentMethodType === "card" || body.paymentMethodType === "us_bank_account") {
      preferredPaymentMethodType = body.paymentMethodType
    }
  } catch {
    preferredPaymentMethodType = undefined
  }

  const result = await prepareBlitzpayInvoiceHostedCheckout({
    admin,
    organizationId,
    invoiceId,
    initiatedBy: "staff_dashboard",
    userId: gate.userId,
    preferredPaymentMethodType,
    invoicePortionCents: undefined,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: result.status })
  }

  const fieldMode = !gate.permissions.canViewFinancials
  if (fieldMode) {
    return NextResponse.json({ url: result.data.url })
  }
  return NextResponse.json({
    url: result.data.url,
    checkoutSessionId: result.data.checkoutSessionId,
  })
}
