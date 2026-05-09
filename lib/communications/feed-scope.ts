/**
 * Phase 28 — visibility rules for assigned-work-only technicians on communication_events.
 */

import type { CommunicationEventRow } from "@/lib/notifications/types"
import type { AssignedWorkScope } from "@/lib/permissions/technician-scope"

/**
 * True when the event is tied to work orders, equipment, or customers in the
 * technician's assigned scope (same boundary as other operational surfaces).
 */
export function communicationEventInAssignedScope(
  r: CommunicationEventRow,
  scope: AssignedWorkScope,
): boolean {
  if (!scope.workOrderIds?.length) return false
  if (!r.related_entity_type || !r.related_entity_id) return false

  const id = r.related_entity_id
  switch (r.related_entity_type) {
    case "work_order":
      return scope.workOrderIds.includes(id)
    case "equipment":
      return scope.equipmentIds.includes(id)
    case "customer":
      return scope.customerIds.includes(id)
    default:
      return false
  }
}
