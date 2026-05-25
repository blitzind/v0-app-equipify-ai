import type {
  ExecutionCapacitySummary,
  ExecutionQueueItem,
} from "@/lib/growth/execution/execution-priority-types"
import { executionPressureLabel } from "@/lib/growth/execution/execution-priority-score"

const DEFAULT_DAILY_CAPACITY_MINUTES = 480

export function computeExecutionCapacity(items: ExecutionQueueItem[]): ExecutionCapacitySummary {
  const criticalItems = items.filter((item) => item.priorityBand === "critical").length
  const highItems = items.filter((item) => item.priorityBand === "high").length
  const estimatedEffortMinutes = items.reduce((sum, item) => sum + item.effortMinutes, 0)
  const unassignedItems = items.filter((item) => !item.ownerUserId).length
  const ownerIds = new Set(items.map((item) => item.ownerUserId).filter(Boolean))

  const operatorFocusLoad = Math.min(
    100,
    Math.round((estimatedEffortMinutes / DEFAULT_DAILY_CAPACITY_MINUTES) * 100),
  )

  const executionPressure = Math.min(
    100,
    Math.round(criticalItems * 12 + highItems * 6 + unassignedItems * 4 + operatorFocusLoad * 0.35),
  )

  return {
    criticalItems,
    highItems,
    totalQueueItems: items.length,
    estimatedEffortMinutes,
    operatorFocusLoad,
    executionPressure,
    executionPressureLabel: executionPressureLabel(executionPressure),
    availableCapacityMinutes: Math.max(0, DEFAULT_DAILY_CAPACITY_MINUTES - estimatedEffortMinutes),
    assignedOwners: ownerIds.size,
    unassignedItems,
  }
}

export function resolvePipelineMomentum(input: {
  criticalItems: number
  highItems: number
  actionsCompletedToday: number
  revenueAtRisk: number
}): { pipelineMomentum: "building" | "stable" | "slipping" | "at_risk"; pipelineMomentumLabel: string } {
  if (input.revenueAtRisk >= 5 || input.criticalItems >= 8) {
    return { pipelineMomentum: "at_risk", pipelineMomentumLabel: "Revenue at risk" }
  }
  if (input.criticalItems >= 4 || input.highItems >= 10) {
    return { pipelineMomentum: "slipping", pipelineMomentumLabel: "Execution slipping" }
  }
  if (input.actionsCompletedToday >= 4 && input.criticalItems <= 2) {
    return { pipelineMomentum: "building", pipelineMomentumLabel: "Momentum building" }
  }
  return { pipelineMomentum: "stable", pipelineMomentumLabel: "Stable pipeline" }
}
