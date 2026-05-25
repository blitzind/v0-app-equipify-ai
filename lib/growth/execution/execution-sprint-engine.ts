import type {
  ExecutionQueueItem,
  ExecutionSprintDuration,
  ExecutionSprintPlan,
  ExecutionSprintType,
} from "@/lib/growth/execution/execution-priority-types"
import { EXECUTION_SPRINT_TYPE_LABELS } from "@/lib/growth/execution/execution-priority-types"

const SPRINT_TASK_BUDGET: Record<ExecutionSprintDuration, number> = {
  30: 3,
  60: 5,
  90: 7,
}

const SPRINT_EFFORT_CAP: Record<ExecutionSprintDuration, number> = {
  30: 30,
  60: 60,
  90: 90,
}

function sprintTypeForItem(item: ExecutionQueueItem): ExecutionSprintType {
  if (item.category === "renewal") return "renewal_protection"
  if (item.category === "follow_up_recovery") return "follow_up_recovery"
  if (item.category === "meeting_completion") return "meeting_completion"
  if (item.category === "research") return "research_buildout"
  if (item.category === "sequence") return "sequence_cleanup"
  if (item.category === "deal_closing") return "deal_closing"
  if (item.priorityBand === "critical" || item.category === "revenue_protection") return "revenue_rescue"
  return "follow_up_recovery"
}

function filterItemsForSprintType(items: ExecutionQueueItem[], sprintType: ExecutionSprintType): ExecutionQueueItem[] {
  const categoryMap: Partial<Record<ExecutionSprintType, ExecutionQueueItem["category"][]>> = {
    revenue_rescue: ["revenue_protection", "renewal"],
    deal_closing: ["deal_closing"],
    follow_up_recovery: ["follow_up_recovery"],
    research_buildout: ["research"],
    meeting_completion: ["meeting_completion"],
    renewal_protection: ["renewal"],
    sequence_cleanup: ["sequence", "ownership"],
  }
  const categories = categoryMap[sprintType]
  if (!categories) return items
  return items.filter((item) => categories.includes(item.category))
}

export function buildExecutionSprintPlan(input: {
  sprintType: ExecutionSprintType
  durationMinutes: ExecutionSprintDuration
  queueItems: ExecutionQueueItem[]
  status?: ExecutionSprintPlan["status"]
  id?: string
  startedAt?: string | null
}): ExecutionSprintPlan {
  const candidates = filterItemsForSprintType(input.queueItems, input.sprintType)
  const taskBudget = SPRINT_TASK_BUDGET[input.durationMinutes]
  const effortCap = SPRINT_EFFORT_CAP[input.durationMinutes]

  const tasks: ExecutionSprintPlan["tasks"] = []
  let effort = 0
  for (const item of candidates) {
    if (tasks.length >= taskBudget) break
    if (effort + item.effortMinutes > effortCap && tasks.length > 0) continue
    tasks.push({
      queueItemId: item.id,
      title: item.title,
      companyName: item.companyName,
      effortMinutes: item.effortMinutes,
      ctaHref: item.ctaHref,
    })
    effort += item.effortMinutes
  }

  const expectedRevenueImpact = tasks.reduce((sum, task) => {
    const item = input.queueItems.find((entry) => entry.id === task.queueItemId)
    return sum + (item?.revenueInfluence ?? 0)
  }, 0)

  const operatorLoadScore = Math.min(100, Math.round((effort / effortCap) * 100 + tasks.length * 4))

  return {
    id: input.id ?? `sprint:${input.sprintType}:${input.durationMinutes}`,
    sprintType: input.sprintType,
    sprintTypeLabel: EXECUTION_SPRINT_TYPE_LABELS[input.sprintType],
    durationMinutes: input.durationMinutes,
    status: input.status ?? "recommended",
    expectedRevenueImpact,
    tasks,
    taskCount: tasks.length,
    estimatedEffortMinutes: effort,
    operatorLoadScore,
    startedAt: input.startedAt ?? null,
    completedAt: null,
  }
}

export function buildRecommendedExecutionSprints(queueItems: ExecutionQueueItem[]): ExecutionSprintPlan[] {
  const sprintTypes: ExecutionSprintType[] = [
    "revenue_rescue",
    "deal_closing",
    "follow_up_recovery",
    "meeting_completion",
    "renewal_protection",
    "research_buildout",
    "sequence_cleanup",
  ]

  const plans: ExecutionSprintPlan[] = []
  for (const sprintType of sprintTypes) {
    for (const duration of [30, 60, 90] as ExecutionSprintDuration[]) {
      const plan = buildExecutionSprintPlan({ sprintType, durationMinutes: duration, queueItems })
      if (plan.taskCount > 0) plans.push(plan)
    }
  }

  return plans
    .sort((a, b) => b.expectedRevenueImpact - a.expectedRevenueImpact || b.taskCount - a.taskCount)
    .slice(0, 12)
}

export function inferPrimarySprintType(items: ExecutionQueueItem[]): ExecutionSprintType {
  if (items.length === 0) return "follow_up_recovery"
  const top = items[0]!
  return sprintTypeForItem(top)
}
