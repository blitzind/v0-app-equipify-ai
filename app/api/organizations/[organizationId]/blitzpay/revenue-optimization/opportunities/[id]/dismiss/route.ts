import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { dismissRevenueOptimizationOpportunity } from "@/lib/blitzpay/blitzpay-revenue-optimization-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; id: string }> },
) {
  const { organizationId, id } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error

  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/revenue-optimization/opportunities/[id]/dismiss",
  )
  if (schemaResp) return schemaResp

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  try {
    await dismissRevenueOptimizationOpportunity(admin, organizationId, id, {
      actorType: "user",
      actorId: gate.userId,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/revenue-optimization/opportunities/dismiss", e)
  }
}
