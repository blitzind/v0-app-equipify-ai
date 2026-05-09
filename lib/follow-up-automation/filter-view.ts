import type { OrgPermissions } from "@/lib/permissions/model"
import type { FollowUpTaskRow } from "@/lib/follow-up-automation/types"
import { canAccessInvoiceFollowUpTasks } from "@/lib/follow-up-automation/invoice-access"
import { isMaintenanceReminderRuleKey } from "@/lib/follow-up-automation/maintenance-rules"

export function filterFollowUpTasksForViewer(
  rows: FollowUpTaskRow[],
  permissions: OrgPermissions,
  userId: string,
): FollowUpTaskRow[] {
  return rows.filter((r) => {
    if (r.entity_type === "invoice" && !canAccessInvoiceFollowUpTasks(permissions)) return false

    if (permissions.canViewAssignedWorkOrdersOnly) {
      const meta = r.metadata ?? {}
      const techUid = typeof meta.technician_user_id === "string" ? meta.technician_user_id : null
      const assignedTechUid =
        typeof meta.assigned_technician_user_id === "string" ? meta.assigned_technician_user_id : null
      if (r.entity_type === "work_order") {
        return techUid === userId
      }
      if (r.entity_type === "prospect") {
        return r.assigned_to_user_id === userId
      }
      if (r.entity_type === "maintenance_plan") {
        return r.assigned_to_user_id === userId || assignedTechUid === userId
      }
      if (r.entity_type === "equipment" && isMaintenanceReminderRuleKey(r.rule_key)) {
        return r.assigned_to_user_id === userId
      }
      return false
    }

    return true
  })
}
