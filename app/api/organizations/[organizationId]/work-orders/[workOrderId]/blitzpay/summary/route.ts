import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"
import { fetchWorkOrderBlitzpaySummary } from "@/lib/blitzpay/work-order-blitzpay-summary"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; workOrderId: string }> },
) {
  const { organizationId, workOrderId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(workOrderId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancials", "canAssistBlitzpayCollection"])
  if ("error" in gate) return gate.error

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "GET /api/organizations/[organizationId]/work-orders/[workOrderId]/blitzpay/summary",
  )
  if (drift) return drift

  const summary = await fetchWorkOrderBlitzpaySummary(admin, organizationId, workOrderId)
  if (!summary) {
    return NextResponse.json({ error: "not_found", message: "Work order not found." }, { status: 404 })
  }
  const fieldView = !gate.permissions.canViewFinancials
  return NextResponse.json({
    summary,
    fieldView,
  })
}
