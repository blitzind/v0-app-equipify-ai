/** GE-AIOS-2A — AI Work Order status machine (client-safe). Constitutional §16.1. */

import {
  AI_WORK_ORDER_RECOVERABLE_STATUSES,
  AI_WORK_ORDER_TERMINAL_STATUSES,
  type AiWorkOrderStatus,
} from "@/lib/growth/aios/ai-work-order-types"

const TRANSITIONS: Record<AiWorkOrderStatus, readonly AiWorkOrderStatus[]> = {
  issued: ["planning", "cancelled"],
  planning: ["awaiting_decision", "cancelled", "failed"],
  awaiting_decision: ["awaiting_approval", "executing", "planning", "cancelled", "failed"],
  awaiting_approval: ["executing", "waiting", "cancelled", "failed"],
  executing: ["waiting", "monitoring", "completed", "failed", "escalated", "cancelled"],
  waiting: ["executing", "monitoring", "escalated", "cancelled", "failed"],
  monitoring: ["executing", "completed", "escalated", "cancelled", "failed"],
  escalated: ["executing", "waiting", "completed", "cancelled", "failed"],
  completed: [],
  cancelled: [],
  failed: ["issued"],
}

export function canTransitionAiWorkOrderStatus(
  from: AiWorkOrderStatus,
  to: AiWorkOrderStatus,
): boolean {
  if (from === to) return false
  return TRANSITIONS[from].includes(to)
}

export function assertAiWorkOrderTransitionAllowed(
  from: AiWorkOrderStatus,
  to: AiWorkOrderStatus,
): void {
  if (!canTransitionAiWorkOrderStatus(from, to)) {
    throw new Error(`ai_work_order_invalid_transition: ${from} → ${to}`)
  }
}

export function canCancelAiWorkOrderStatus(status: AiWorkOrderStatus): boolean {
  return !(AI_WORK_ORDER_TERMINAL_STATUSES as readonly string[]).includes(status)
}

export function canRetryAiWorkOrder(input: {
  status: AiWorkOrderStatus
  retryCount: number
  maxRetries: number
}): boolean {
  if (!(AI_WORK_ORDER_RECOVERABLE_STATUSES as readonly string[]).includes(input.status)) {
    return false
  }
  return input.retryCount < input.maxRetries
}

export function canArchiveAiWorkOrderStatus(status: AiWorkOrderStatus): boolean {
  return (
    (AI_WORK_ORDER_TERMINAL_STATUSES as readonly string[]).includes(status) || status === "failed"
  )
}

export function aiWorkOrderStatusLabel(status: AiWorkOrderStatus): string {
  return status.replaceAll("_", " ")
}

/** Maps simplified operator vocabulary to constitutional statuses (documentation aid). */
export const AI_WORK_ORDER_STATUS_OPERATOR_ALIASES: Record<string, AiWorkOrderStatus> = {
  queued: "issued",
  ready: "planning",
  running: "executing",
  waiting: "waiting",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
  escalated: "escalated",
  retrying: "issued",
}

export function resolveAiWorkOrderStatusesForFilter(
  status: AiWorkOrderStatus | AiWorkOrderStatus[],
): AiWorkOrderStatus[] {
  return Array.isArray(status) ? status : [status]
}
