import type { OrgPermissions } from "@/lib/permissions/model"
import type { FollowUpTaskRow } from "@/lib/follow-up-automation/types"

export function filterFollowUpTasksForViewer(
  rows: FollowUpTaskRow[],
  permissions: OrgPermissions,
  userId: string,
): FollowUpTaskRow[] {
  return rows.filter((r) => {
    if (r.entity_type === "invoice" && !permissions.canViewFinancials) return false

    if (permissions.canViewAssignedWorkOrdersOnly) {
      const meta = r.metadata ?? {}
      const techUid = typeof meta.technician_user_id === "string" ? meta.technician_user_id : null
      if (r.entity_type === "work_order") {
        return techUid === userId
      }
      if (r.entity_type === "prospect") {
        return r.assigned_to_user_id === userId
      }
      return false
    }

    return true
  })
}
