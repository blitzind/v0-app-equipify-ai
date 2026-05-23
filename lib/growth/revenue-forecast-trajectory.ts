import type {
  GrowthLeadRevenueForecastInput,
  GrowthRevenueProbabilityTier,
  GrowthRevenueTrajectory,
} from "@/lib/growth/revenue-forecast-types"
import { isRevenueTierRegression } from "@/lib/growth/revenue-forecast-contribution"

const ACCELERATING_DELTA = 8
const SLOWING_DELTA = -5
const AT_RISK_DELTA = -10

export function computeRevenueTrajectory(input: {
  previousScore: number | null
  currentScore: number
  previousTier: GrowthRevenueProbabilityTier | null
  currentTier: GrowthRevenueProbabilityTier
  opportunityReadinessTrend: GrowthLeadRevenueForecastInput["opportunityReadinessTrend"]
  relationshipTrend: GrowthLeadRevenueForecastInput["relationshipTrend"]
  workflowHealth: GrowthLeadRevenueForecastInput["workflowHealth"]
}): GrowthRevenueTrajectory {
  const delta =
    input.previousScore != null ? input.currentScore - input.previousScore : 0

  if (
    delta <= AT_RISK_DELTA ||
    isRevenueTierRegression(input.previousTier, input.currentTier) ||
    (input.relationshipTrend === "cooling" &&
      (input.workflowHealth === "stalled" || input.workflowHealth === "blocked"))
  ) {
    return "at_risk"
  }

  if (
    delta >= ACCELERATING_DELTA ||
    (input.opportunityReadinessTrend === "improving" && input.relationshipTrend === "improving")
  ) {
    return "accelerating"
  }

  if (
    delta <= SLOWING_DELTA ||
    input.opportunityReadinessTrend === "declining" ||
    input.relationshipTrend === "cooling"
  ) {
    return "slowing"
  }

  return "steady"
}

export function computeRevenueProbabilityVolatility(input: {
  previousScore: number | null
  currentScore: number
  previousConfidence: number | null
  currentConfidence: number
  previousTier: GrowthRevenueProbabilityTier | null
  currentTier: GrowthRevenueProbabilityTier
  blockerCount: number
}): number {
  let volatility = 0

  if (input.previousScore != null) {
    volatility += Math.min(40, Math.abs(input.currentScore - input.previousScore) * 2)
  }

  if (input.previousConfidence != null) {
    volatility += Math.min(20, Math.abs(input.currentConfidence - input.previousConfidence))
  }

  if (isRevenueTierRegression(input.previousTier, input.currentTier)) {
    volatility += 25
  } else if (
    input.previousTier &&
    input.previousTier !== input.currentTier
  ) {
    volatility += 12
  }

  volatility += Math.min(15, input.blockerCount * 4)

  return Math.min(100, Math.round(volatility))
}

export function isForecastRegression(input: {
  previousScore: number | null
  currentScore: number
  previousTier: GrowthRevenueProbabilityTier | null
  currentTier: GrowthRevenueProbabilityTier
  trajectory: GrowthRevenueTrajectory
}): boolean {
  if (input.trajectory === "at_risk") return true
  if (isRevenueTierRegression(input.previousTier, input.currentTier)) return true
  if (input.previousScore != null && input.currentScore - input.previousScore <= -10) return true
  return false
}
