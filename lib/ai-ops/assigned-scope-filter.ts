import type { AssignedWorkScope } from "@/lib/permissions/technician-scope"
import type { Recommendation } from "./types"

function includesId(list: string[] | undefined, id: string | undefined): boolean {
  if (!id || !list?.length) return false
  return list.includes(id)
}

/**
 * For assigned-work-only technicians, keep only recommendations tied to their
 * assigned work orders or linked customer/equipment scope. Org-wide aggregates
 * (no entity) are hidden. When there are zero assigned work orders, hide all
 * operational insights so nothing leaks outside the assignment boundary.
 */
export function filterRecommendationsForAssignedScope(
  items: Recommendation[],
  scope: AssignedWorkScope | null,
): Recommendation[] {
  if (!scope?.workOrderIds?.length) return []

  const woIds = new Set(scope.workOrderIds)

  return items.filter((rec) => {
    if (!rec.entity) return false
    const et = rec.entity.type
    const id = rec.entity.id
    if (et === "work_order" && id && woIds.has(id)) return true
    if (et === "equipment" && includesId(scope.equipmentIds, id)) return true
    if (et === "customer" && includesId(scope.customerIds, id)) return true
    return false
  })
}
