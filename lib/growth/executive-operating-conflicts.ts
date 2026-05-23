import { isForecastRegression } from "@/lib/growth/revenue-forecast-trajectory"
import type {
  GrowthIntelligenceConflict,
  GrowthLeadExecutiveOperatingInput,
} from "@/lib/growth/executive-operating-types"

function tierFromScore(score: number): import("@/lib/growth/revenue-forecast-types").GrowthRevenueProbabilityTier {
  if (score >= 85) return "commit_candidate"
  if (score >= 65) return "forecasted"
  if (score >= 45) return "probable"
  if (score >= 25) return "possible"
  return "unlikely"
}

export function detectIntelligenceConflicts(
  input: GrowthLeadExecutiveOperatingInput,
): GrowthIntelligenceConflict[] {
  const conflicts: GrowthIntelligenceConflict[] = []
  const fit = input.fit ?? 0
  const engagementTier = input.engagementTier ?? null

  if (fit >= 70 && (engagementTier === "cold" || engagementTier === "warming")) {
    conflicts.push({
      key: "high_fit_low_engagement",
      label: "High fit with low engagement",
      severity: "warning",
    })
  }

  if (
    engagementTier === "hot" &&
    (input.relationshipStrengthTier === "unknown" ||
      input.relationshipStrengthTier === "developing")
  ) {
    conflicts.push({
      key: "hot_engagement_poor_relationship",
      label: "Hot engagement with weak relationship depth",
      severity: "warning",
    })
  }

  if (
    (input.revenueProbabilityTier === "commit_candidate" ||
      input.revenueProbabilityTier === "forecasted") &&
    input.revenueProbabilityConfidence < 45
  ) {
    conflicts.push({
      key: "commit_candidate_low_confidence",
      label: "High revenue tier with low forecast confidence",
      severity: "critical",
    })
  }

  if (
    input.relationshipStrengthTier === "strategic" &&
    (input.workflowHealth === "stalled" || input.workflowHealth === "blocked")
  ) {
    conflicts.push({
      key: "strategic_stalled_workflow",
      label: "Strategic relationship with stalled workflow",
      severity: "critical",
    })
  }

  const previousRevenueTier =
    input.revenueProbabilityPreviousScore != null
      ? tierFromScore(input.revenueProbabilityPreviousScore)
      : null

  if (
    input.revenueProbabilityTier === "commit_candidate" &&
    isForecastRegression({
      previousScore: input.revenueProbabilityPreviousScore,
      currentScore: input.revenueProbabilityScore ?? 0,
      previousTier: previousRevenueTier,
      currentTier: input.revenueProbabilityTier ?? "unlikely",
      trajectory: input.revenueTrajectory,
    })
  ) {
    conflicts.push({
      key: "commit_regression_risk",
      label: "Commit candidate with forecast regression risk",
      severity: "critical",
    })
  }

  if (
    input.opportunityReadinessTier === "priority_opportunity" &&
    input.opportunityBlockerKeys.includes("missing_decision_maker")
  ) {
    conflicts.push({
      key: "priority_opportunity_missing_dm",
      label: "Priority opportunity missing decision maker",
      severity: "critical",
    })
  }

  if (
    input.forecastAttentionLevel === "critical" &&
    (input.revenueProbabilityScore ?? 0) < 45
  ) {
    conflicts.push({
      key: "high_attention_low_probability",
      label: "Critical forecast attention with low revenue probability",
      severity: "warning",
    })
  }

  return conflicts
}

export function computeIntelligenceConflictSeverityScore(
  conflicts: GrowthIntelligenceConflict[],
): number {
  if (conflicts.length === 0) return 0

  let score = 0
  for (const conflict of conflicts) {
    score += conflict.severity === "critical" ? 22 : 12
  }
  return Math.min(100, Math.round(score))
}
