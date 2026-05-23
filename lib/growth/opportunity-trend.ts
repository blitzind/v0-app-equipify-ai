import type {
  GrowthOpportunityReadinessTier,
  GrowthOpportunityReadinessTrend,
} from "@/lib/growth/opportunity-types"

const IMPROVING_DELTA = 8
const DECLINING_DELTA = -8

const TIER_RANK: Record<GrowthOpportunityReadinessTier, number> = {
  not_ready: 0,
  developing: 1,
  qualified: 2,
  sales_ready: 3,
  priority_opportunity: 4,
}

export function minOpportunityReadinessTier(
  a: GrowthOpportunityReadinessTier,
  b: GrowthOpportunityReadinessTier,
): GrowthOpportunityReadinessTier {
  return TIER_RANK[a] <= TIER_RANK[b] ? a : b
}

export function computeOpportunityReadinessTrend(input: {
  previousScore: number | null
  currentScore: number
  previousTrend: GrowthOpportunityReadinessTrend | null
  newCriticalBlocker: boolean
  resolvedCriticalBlocker: boolean
}): GrowthOpportunityReadinessTrend {
  const delta =
    input.previousScore != null ? input.currentScore - input.previousScore : 0

  if (input.resolvedCriticalBlocker && delta >= 0) return "improving"
  if (delta >= IMPROVING_DELTA) return "improving"
  if (delta <= DECLINING_DELTA || input.newCriticalBlocker) return "declining"
  if (input.previousTrend === "declining" && delta > 0) return "improving"
  return "stable"
}
