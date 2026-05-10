import type { MaintenancePlan } from "@/lib/mock-data"
import type { AssignedWorkScope } from "@/lib/permissions/technician-scope"

/**
 * Mirrors assigned-work visibility: plan is visible if it ties to a customer, asset, or assignee
 * the user is allowed to see (same coarse signals as work-order list scoping).
 */
export function filterMaintenancePlansForAssignedScope(
  plans: MaintenancePlan[],
  args: {
    assignedOnly: boolean
    userId: string
    scope: AssignedWorkScope | null
  },
): MaintenancePlan[] {
  if (!args.assignedOnly) return plans
  const scope = args.scope
  if (!scope) return []

  const customerIds = scope.customerIds ?? []
  const equipmentIds = scope.equipmentIds ?? []
  const technicianIds = scope.technicianIds ?? []

  return plans.filter((plan) => {
    const cid = plan.customerId ?? ""
    if (cid && customerIds.includes(cid)) return true
    if (plan.equipmentId?.trim() && equipmentIds.includes(plan.equipmentId.trim())) return true
    const tid = plan.technicianId?.trim()
    if (tid) {
      if (tid === args.userId) return true
      if (technicianIds.includes(tid)) return true
    }
    return false
  })
}
