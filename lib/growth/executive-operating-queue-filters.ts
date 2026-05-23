import type {
  GrowthExecutiveOperatingQueueFilter,
  GrowthExecutivePriorityTier,
} from "@/lib/growth/executive-operating-types"
import type { GrowthLeadStatus } from "@/lib/growth/types"

export type ExecutiveOperatingQueueFilterRow = {
  status: GrowthLeadStatus
  executivePriorityScore: number | null
  executivePriorityTier: GrowthExecutivePriorityTier | null
  intelligenceConflictSeverityScore: number
  intelligenceConflictCount: number
  executiveInterventionAgeBucket: string | null
  workflowHealth: string | null
  opportunityBlockerCount: number
}

const TERMINAL = new Set<GrowthLeadStatus>(["converted", "disqualified", "archived"])

export function matchesExecutiveOperatingQueueFilter(
  filter: GrowthExecutiveOperatingQueueFilter,
  row: ExecutiveOperatingQueueFilterRow,
): boolean {
  if (TERMINAL.has(row.status)) return false

  switch (filter) {
    case "executive_now":
      return row.executivePriorityTier === "executive_now"
    case "executive_priority":
      return (
        row.executivePriorityTier === "priority" || row.executivePriorityTier === "executive_now"
      )
    case "leadership_bottlenecks":
      return (
        row.intelligenceConflictSeverityScore >= 40 ||
        row.opportunityBlockerCount >= 3 ||
        row.workflowHealth === "stalled" ||
        row.workflowHealth === "blocked" ||
        row.executiveInterventionAgeBucket === "aging" ||
        row.executiveInterventionAgeBucket === "stalled"
      )
    case "intelligence_conflicts":
      return row.intelligenceConflictCount > 0
    default:
      return false
  }
}

export function isGrowthExecutiveOperatingCallQueueFilter(
  value: string,
): value is GrowthExecutiveOperatingQueueFilter {
  return ["executive_now", "executive_priority", "leadership_bottlenecks", "intelligence_conflicts"].includes(
    value,
  )
}
