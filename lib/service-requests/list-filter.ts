import type { OrgPermissions } from "@/lib/permissions/model"
import { hasOrgPermission } from "@/lib/permissions/model"

export type ServiceRequestRowLike = {
  assigned_to_user_id: string | null
}

export function canReadServiceRequestQueue(permissions: OrgPermissions): boolean {
  return (
    hasOrgPermission(permissions, "canManageDispatch") ||
    hasOrgPermission(permissions, "canViewAllWorkOrders") ||
    hasOrgPermission(permissions, "canViewOperationalReports") ||
    hasOrgPermission(permissions, "canViewAssignedWorkOrdersOnly")
  )
}

/**
 * Technicians only see rows explicitly assigned to them; everyone else with queue access sees the full org list.
 */
export function filterServiceRequestsForMember<T extends ServiceRequestRowLike>(
  rows: T[],
  permissions: OrgPermissions,
  userId: string,
): T[] {
  if (hasOrgPermission(permissions, "canManageDispatch")) return rows
  if (
    hasOrgPermission(permissions, "canViewAssignedWorkOrdersOnly") &&
    !hasOrgPermission(permissions, "canViewAllWorkOrders")
  ) {
    return rows.filter((r) => r.assigned_to_user_id === userId)
  }
  return rows
}
