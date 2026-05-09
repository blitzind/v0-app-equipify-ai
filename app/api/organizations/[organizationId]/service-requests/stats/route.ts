import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import {
  canReadServiceRequestQueue,
  filterServiceRequestsForMember,
} from "@/lib/service-requests/list-filter"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireAnyOrgPermission(organizationId, [
    "canManageDispatch",
    "canViewAllWorkOrders",
    "canViewOperationalReports",
    "canViewAssignedWorkOrdersOnly",
  ])
  if ("error" in gate) return gate.error

  if (!canReadServiceRequestQueue(gate.permissions)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const { data, error } = await gate.supabase
    .from("org_service_requests")
    .select("id, status, urgency, assigned_to_user_id")
    .eq("organization_id", organizationId)
    .in("status", ["new", "reviewing", "needs_info", "approved"])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = filterServiceRequestsForMember(data ?? [], gate.permissions, gate.userId)

  const newCount = rows.filter((r) => (r as { status: string }).status === "new").length
  const urgent = rows.filter(
    (r) =>
      (r as { urgency: string }).urgency === "high" || (r as { urgency: string }).urgency === "critical",
  ).length
  const needsInfo = rows.filter((r) => (r as { status: string }).status === "needs_info").length

  return NextResponse.json({
    new_count: newCount,
    urgent_open_count: urgent,
    needs_info_count: needsInfo,
    open_total: rows.length,
  })
}
