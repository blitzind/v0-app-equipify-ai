import type {
  GrowthOpportunityQueueFilter,
  GrowthOpportunityReadinessTier,
} from "@/lib/growth/opportunity-types"
import type { GrowthLeadStatus } from "@/lib/growth/types"

export type OpportunityQueueFilterRow = {
  status: GrowthLeadStatus
  score: number | null
  opportunityReadinessScore: number | null
  opportunityReadinessTier: GrowthOpportunityReadinessTier | null
  opportunityBlockers: Array<{ key: string }>
}

const TERMINAL = new Set<GrowthLeadStatus>(["converted", "disqualified", "archived"])

export function matchesOpportunityQueueFilter(
  filter: GrowthOpportunityQueueFilter,
  row: OpportunityQueueFilterRow,
): boolean {
  if (TERMINAL.has(row.status)) return false

  switch (filter) {
    case "priority_opportunities":
      return row.opportunityReadinessTier === "priority_opportunity"
    case "sales_ready":
      return row.opportunityReadinessTier === "sales_ready"
    case "needs_qualification":
      return (
        (row.opportunityReadinessTier === "not_ready" ||
          row.opportunityReadinessTier === "developing") &&
        (row.score ?? 0) >= 50
      )
    case "blocked_opportunities":
      return (
        row.opportunityBlockers.length > 0 &&
        row.opportunityReadinessTier !== "priority_opportunity"
      )
    default:
      return false
  }
}

export function isGrowthOpportunityCallQueueFilter(
  value: string,
): value is GrowthOpportunityQueueFilter {
  return [
    "priority_opportunities",
    "sales_ready",
    "needs_qualification",
    "blocked_opportunities",
  ].includes(value)
}
