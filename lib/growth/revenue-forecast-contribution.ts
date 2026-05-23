import type {
  GrowthForecastAttentionLevel,
  GrowthLeadRevenueForecastInput,
  GrowthRevenueProbabilityTier,
} from "@/lib/growth/revenue-forecast-types"

const TIER_RANK: Record<GrowthRevenueProbabilityTier, number> = {
  unlikely: 0,
  possible: 1,
  probable: 2,
  forecasted: 3,
  commit_candidate: 4,
}

function clampWeight(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function computeForecastContributionWeight(input: {
  tier: GrowthRevenueProbabilityTier
  confidence: number
  buyingSignalStrength: GrowthLeadRevenueForecastInput["opportunityBuyingSignalStrength"]
}): number {
  let weight = 0
  switch (input.tier) {
    case "commit_candidate":
      weight = 95
      break
    case "forecasted":
      weight = 78
      break
    case "probable":
      weight = 55
      break
    case "possible":
      weight = 30
      break
    default:
      weight = 10
  }

  if (input.confidence >= 70) weight += 5
  else if (input.confidence < 45) weight -= 8

  if (input.buyingSignalStrength === "strong") weight += 5
  else if (input.buyingSignalStrength === "moderate") weight += 2

  return clampWeight(weight)
}

export function computeForecastAttentionLevel(input: {
  tier: GrowthRevenueProbabilityTier
  fit: number | null
  confidence: number
  trajectory: import("@/lib/growth/revenue-forecast-types").GrowthRevenueTrajectory
  workflowHealth: GrowthLeadRevenueForecastInput["workflowHealth"]
  relationshipTrend: GrowthLeadRevenueForecastInput["relationshipTrend"]
}): GrowthForecastAttentionLevel {
  const fit = input.fit ?? 0

  if (input.tier === "commit_candidate" && fit > 85) return "critical"
  if (input.tier === "commit_candidate" || (input.tier === "forecasted" && input.confidence >= 60)) {
    return "important"
  }
  if (
    input.tier === "forecasted" ||
    input.tier === "probable" ||
    input.trajectory === "at_risk" ||
    input.trajectory === "slowing"
  ) {
    if (fit > 70 && (input.relationshipTrend === "cooling" || input.workflowHealth === "stalled")) {
      return "monitor"
    }
    if (input.tier === "forecasted" || input.tier === "probable") return "monitor"
  }
  return "none"
}

export function isRevenueTierRegression(
  previous: GrowthRevenueProbabilityTier | null,
  current: GrowthRevenueProbabilityTier,
): boolean {
  if (!previous) return false
  return TIER_RANK[current] < TIER_RANK[previous]
}
