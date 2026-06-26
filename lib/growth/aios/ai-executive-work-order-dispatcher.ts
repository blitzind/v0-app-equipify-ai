/** GE-AIOS-2G — Work Order dispatcher + agent assignment (client-safe). */

import { AI_OS_DEFAULT_AGENT_CAPABILITIES } from "@/lib/growth/aios/ai-agent-runtime-capabilities"
import type { AiOsRuntimeAgent } from "@/lib/growth/aios/ai-agent-runtime-types"
import type { AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"

export function resolveExecutiveAgentForWorkOrderType(workOrderType: AiWorkOrderType): AiOsRuntimeAgent {
  for (const [agentKey, workOrderTypes] of Object.entries(AI_OS_DEFAULT_AGENT_CAPABILITIES)) {
    if ((workOrderTypes as readonly AiWorkOrderType[]).includes(workOrderType)) {
      return agentKey as AiOsRuntimeAgent
    }
  }
  return "research"
}

export function canExecutiveBrainDelegateWorkOrderType(_workOrderType: AiWorkOrderType): boolean {
  return true
}

export function executiveWorkOrderDispatchPlan(input: {
  workOrderType: AiWorkOrderType
  assignedAgent?: AiOsRuntimeAgent
}): { assignedAgent: AiOsRuntimeAgent; ownerAgent: "executive_brain" } {
  const assignedAgent = input.assignedAgent ?? resolveExecutiveAgentForWorkOrderType(input.workOrderType)
  return {
    assignedAgent,
    ownerAgent: "executive_brain",
  }
}

export function classifyExecutiveWorkOrderCounts(input: {
  statuses: string[]
}): {
  pending: number
  active: number
  completed: number
} {
  const pendingStatuses = new Set(["issued", "planning", "awaiting_decision", "awaiting_approval"])
  const activeStatuses = new Set(["executing", "waiting", "monitoring", "escalated"])
  const completedStatuses = new Set(["completed", "cancelled", "failed"])

  let pending = 0
  let active = 0
  let completed = 0

  for (const status of input.statuses) {
    if (pendingStatuses.has(status)) pending += 1
    else if (activeStatuses.has(status)) active += 1
    else if (completedStatuses.has(status)) completed += 1
  }

  return { pending, active, completed }
}

export function isExecutiveMissionComplete(input: {
  pending: number
  active: number
  totalDelegations: number
}): boolean {
  return input.totalDelegations > 0 && input.pending === 0 && input.active === 0
}
