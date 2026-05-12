import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { listConsolidatedSnapshotsForGroups, listVisibleFinancialGroupsForOrganization } from "@/lib/blitzpay/blitzpay-multi-entity-finance"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/multi-entity/consolidated-snapshots",
  )
  if (schemaResp) return schemaResp
  let limit = 20
  try {
    const u = new URL(request.url)
    const raw = u.searchParams.get("limit")
    if (raw != null) limit = Number(raw)
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
    const groups = await listVisibleFinancialGroupsForOrganization(admin, organizationId)
    const groupIds = groups.map((g) => g.id).sort((a, b) => a.localeCompare(b))
    const snapshots = await listConsolidatedSnapshotsForGroups(admin, groupIds, limit)
    return NextResponse.json({ snapshots })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/multi-entity/consolidated-snapshots", e)
  }
}
