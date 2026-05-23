import type {
  GrowthRevenueForecastQueueFilter,
  GrowthRevenueProbabilityTier,
} from "@/lib/growth/revenue-forecast-types"
import type { GrowthLeadStatus } from "@/lib/growth/types"

export type RevenueForecastQueueFilterRow = {
  status: GrowthLeadStatus
  revenueProbabilityScore: number | null
  revenueProbabilityTier: GrowthRevenueProbabilityTier | null
  revenueProbabilityConfidence: number
}

const TERMINAL = new Set<GrowthLeadStatus>(["converted", "disqualified", "archived"])

export function matchesRevenueForecastQueueFilter(
  filter: GrowthRevenueForecastQueueFilter,
  row: RevenueForecastQueueFilterRow,
): boolean {
  if (TERMINAL.has(row.status)) return false

  switch (filter) {
    case "commit_candidates":
      return row.revenueProbabilityTier === "commit_candidate"
    case "forecasted":
      return row.revenueProbabilityTier === "forecasted"
    case "probable":
      return row.revenueProbabilityTier === "probable"
    case "low_confidence_forecast":
      return (
        row.revenueProbabilityConfidence < 45 &&
        (row.revenueProbabilityTier === "possible" ||
          row.revenueProbabilityTier === "probable" ||
          row.revenueProbabilityTier === "forecasted" ||
          row.revenueProbabilityTier === "commit_candidate")
      )
    default:
      return false
  }
}

export function isGrowthRevenueForecastCallQueueFilter(
  value: string,
): value is GrowthRevenueForecastQueueFilter {
  return ["commit_candidates", "forecasted", "probable", "low_confidence_forecast"].includes(value)
}
