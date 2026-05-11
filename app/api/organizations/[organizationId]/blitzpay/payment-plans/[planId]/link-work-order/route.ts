import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { attachWorkOrderToPaymentPlan } from "@/lib/blitzpay/blitzpay-payment-plan-work-order"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; planId: string }> },
) {
  const { organizationId, planId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(planId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireOrgPermission(organizationId, ["canEditInvoices", "canViewFinancials"])
  if ("error" in gate) return gate.error

  let body: { workOrderId?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 })
  }
  const workOrderId = String(body.workOrderId ?? "").trim()
  if (!UUID_RE.test(workOrderId)) {
    return NextResponse.json({ error: "bad_request", message: "workOrderId is required." }, { status: 400 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "POST /api/organizations/[organizationId]/blitzpay/payment-plans/[planId]/link-work-order",
  )
  if (drift) return drift

  const res = await attachWorkOrderToPaymentPlan(admin, {
    organizationId,
    paymentPlanId: planId,
    workOrderId,
  })
  if (!res.ok) {
    const status =
      res.code === "plan_not_found" ? 404
      : res.code === "invoice_not_on_work_order" || res.code === "plan_already_linked" ? 409
      : 400
    return NextResponse.json({ error: res.code, message: res.message }, { status })
  }
  return NextResponse.json({ ok: true })
}
