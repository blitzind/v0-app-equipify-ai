/** GE-AIOS-2C — Work order claim transition paths (client-safe). */

import type { AiWorkOrderStatus } from "@/lib/growth/aios/ai-work-order-types"

/** Statuses an agent runtime may claim from. */
export const AI_OS_CLAIMABLE_WORK_ORDER_STATUSES: readonly AiWorkOrderStatus[] = [
  "issued",
  "planning",
  "awaiting_decision",
  "awaiting_approval",
  "waiting",
]

export function buildClaimTransitionPath(currentStatus: AiWorkOrderStatus): AiWorkOrderStatus[] {
  switch (currentStatus) {
    case "issued":
      return ["planning", "awaiting_decision", "executing"]
    case "planning":
      return ["awaiting_decision", "executing"]
    case "awaiting_decision":
    case "awaiting_approval":
    case "waiting":
      return ["executing"]
    default:
      return []
  }
}

export function canAgentRuntimeClaimWorkOrderStatus(status: AiWorkOrderStatus): boolean {
  return (AI_OS_CLAIMABLE_WORK_ORDER_STATUSES as readonly string[]).includes(status)
}
