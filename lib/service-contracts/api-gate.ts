import type { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"

/** Any role that can open operational surfaces in the org (contracts are non-financial). */
export async function requireOrgOperationalRead(organizationId: string) {
  return requireAnyOrgPermission(organizationId, [
    "canViewCommunications",
    "canViewOperationalReports",
    "canManageDispatch",
    "canViewAllWorkOrders",
    "canViewAssignedWorkOrdersOnly",
  ])
}

export type OrgReadGate = Awaited<ReturnType<typeof requireOrgOperationalRead>>

export function isGateError(g: OrgReadGate | { error: NextResponse }): g is { error: NextResponse } {
  return "error" in g
}
