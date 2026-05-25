import type { ExecutionQueueItem } from "@/lib/growth/execution/execution-priority-types"

export type OperatorWorkloadEntry = {
  ownerUserId: string | null
  itemCount: number
  criticalCount: number
  estimatedEffortMinutes: number
  loadScore: number
}

export function balanceExecutionWorkload(items: ExecutionQueueItem[]): {
  balanced: ExecutionQueueItem[]
  workloads: OperatorWorkloadEntry[]
} {
  const workloadMap = new Map<string | null, OperatorWorkloadEntry>()

  for (const item of items) {
    const key = item.ownerUserId
    const entry = workloadMap.get(key) ?? {
      ownerUserId: key,
      itemCount: 0,
      criticalCount: 0,
      estimatedEffortMinutes: 0,
      loadScore: 0,
    }
    entry.itemCount += 1
    if (item.priorityBand === "critical") entry.criticalCount += 1
    entry.estimatedEffortMinutes += item.effortMinutes
    entry.loadScore = Math.min(100, entry.criticalCount * 15 + entry.itemCount * 5)
    workloadMap.set(key, entry)
  }

  const workloads = [...workloadMap.values()].sort((a, b) => b.loadScore - a.loadScore)

  const balanced = [...items].sort((a, b) => {
    const loadA = workloadMap.get(a.ownerUserId)?.loadScore ?? 0
    const loadB = workloadMap.get(b.ownerUserId)?.loadScore ?? 0
    if (a.priorityBand === "critical" && b.priorityBand !== "critical") return -1
    if (b.priorityBand === "critical" && a.priorityBand !== "critical") return 1
    if (loadA !== loadB) return loadA - loadB
    return b.executionPriorityScore - a.executionPriorityScore
  })

  return { balanced, workloads }
}

export function pickUnassignedForRebalance(items: ExecutionQueueItem[], limit = 5): ExecutionQueueItem[] {
  return items.filter((item) => !item.ownerUserId).slice(0, limit)
}
