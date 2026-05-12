import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { fetchRevenueOptimizationOpportunities } from "@/lib/blitzpay/blitzpay-revenue-optimization-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error

  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/revenue-optimization/opportunities",
  )
  if (schemaResp) return schemaResp

  let status: "active" | "all" = "active"
  try {
    const u = new URL(request.url)
    if (u.searchParams.get("status") === "all") status = "all"
  } catch {
    /* ignore */
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  try {
    const opportunities = await fetchRevenueOptimizationOpportunities(admin, organizationId, { status })
    return NextResponse.json({ opportunities })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/revenue-optimization/opportunities", e)
  }
}
