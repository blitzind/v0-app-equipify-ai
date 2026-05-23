import { isExecutiveCloseCandidate } from "@/lib/growth/executive-operating-close-candidate"
import {
  computeIntelligenceConflictSeverityScore,
  detectIntelligenceConflicts,
} from "@/lib/growth/executive-operating-conflicts"
import { buildExecutiveRecommendation } from "@/lib/growth/executive-operating-recommendation"
import type {
  GrowthExecutiveInterventionAgeBucket,
  GrowthExecutiveOperatingTopSignal,
  GrowthExecutivePriorityTier,
  GrowthLeadExecutiveOperatingInput,
  GrowthLeadExecutiveOperatingResult,
} from "@/lib/growth/executive-operating-types"
import { isForecastRegression } from "@/lib/growth/revenue-forecast-trajectory"

const TERMINAL_STATUSES = new Set(["converted", "disqualified", "archived"])

const TIER_FROM_SCORE: Array<{ min: number; tier: GrowthExecutivePriorityTier }> = [
  { min: 85, tier: "executive_now" },
  { min: 70, tier: "priority" },
  { min: 45, tier: "important" },
  { min: 0, tier: "monitor" },
]

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function tierFromScore(score: number): GrowthExecutivePriorityTier {
  for (const entry of TIER_FROM_SCORE) {
    if (score >= entry.min) return entry.tier
  }
  return "monitor"
}

function tierFromRevenueScore(score: number): import("@/lib/growth/revenue-forecast-types").GrowthRevenueProbabilityTier {
  if (score >= 85) return "commit_candidate"
  if (score >= 65) return "forecasted"
  if (score >= 45) return "probable"
  if (score >= 25) return "possible"
  return "unlikely"
}

export function computeExecutiveInterventionAgeBucket(
  openedAt: string | null,
  now: Date = new Date(),
): GrowthExecutiveInterventionAgeBucket {
  if (!openedAt) return "new"
  const opened = Date.parse(openedAt)
  if (Number.isNaN(opened)) return "new"
  const days = (now.getTime() - opened) / (24 * 60 * 60 * 1000)
  if (days <= 3) return "new"
  if (days <= 14) return "active"
  if (days <= 30) return "aging"
  return "stalled"
}

export function isExecutiveInterventionNeeded(input: GrowthLeadExecutiveOperatingInput): boolean {
  const previousRevenueTier =
    input.revenueProbabilityPreviousScore != null
      ? tierFromRevenueScore(input.revenueProbabilityPreviousScore)
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
    return true
  }

  const conflicts = detectIntelligenceConflicts(input)
  return conflicts.some((conflict) => conflict.key === "commit_regression_risk")
}

export function computeExecutivePriorityVolatility(input: {
  previousScore: number | null
  currentScore: number
  previousTier: GrowthExecutivePriorityTier | null
  currentTier: GrowthExecutivePriorityTier
  previousConflictCount: number
  currentConflictCount: number
  revenueVolatility: number
}): number {
  let volatility = 0

  if (input.previousScore != null) {
    volatility += Math.min(35, Math.abs(input.currentScore - input.previousScore) * 2)
  }

  if (input.previousTier && input.previousTier !== input.currentTier) {
    volatility += 20
  }

  volatility += Math.min(20, Math.abs(input.currentConflictCount - input.previousConflictCount) * 8)
  volatility += Math.min(25, Math.round(input.revenueVolatility * 0.25))

  return Math.min(100, Math.round(volatility))
}

export function computeGrowthLeadExecutiveOperating(
  input: GrowthLeadExecutiveOperatingInput,
): GrowthLeadExecutiveOperatingResult {
  const now = input.now ?? new Date()
  const conflicts = detectIntelligenceConflicts(input)
  const conflictSeverityScore = computeIntelligenceConflictSeverityScore(conflicts)
  const interventionNeeded = isExecutiveInterventionNeeded(input)

  if (TERMINAL_STATUSES.has(input.status)) {
    return {
      score: 0,
      tier: "monitor",
      summary: "Terminal lead status.",
      topSignals: [],
      volatility: 0,
      conflicts: [],
      conflictSeverityScore: 0,
      recommendation: "No executive action required.",
      owner: null,
      interventionNeeded: false,
      interventionOpenedAt: null,
      interventionAgeBucket: "new",
    }
  }

  const contributions: GrowthExecutiveOperatingTopSignal[] = []
  const fit = input.fit ?? 0

  if (input.revenueProbabilityTier === "commit_candidate") {
    contributions.push({ kind: "commit_candidate", label: "Commit candidate", points: 18 })
  } else if (input.revenueProbabilityTier === "forecasted") {
    contributions.push({ kind: "forecasted", label: "Forecasted revenue", points: 12 })
  }

  if (input.forecastAttentionLevel === "critical") {
    contributions.push({ kind: "critical_attention", label: "Critical forecast attention", points: 16 })
  } else if (input.forecastAttentionLevel === "important") {
    contributions.push({ kind: "important_attention", label: "Important forecast attention", points: 10 })
  }

  if (
    input.revenueTrajectory === "at_risk" ||
    input.revenueTrajectory === "slowing"
  ) {
    contributions.push({
      kind: "forecast_regression",
      label: "Forecast regression risk",
      points: input.revenueTrajectory === "at_risk" ? 14 : 8,
    })
  }

  if (input.relationshipStrengthTier === "strategic" && input.relationshipTrend === "cooling") {
    contributions.push({
      kind: "strategic_cooling",
      label: "Strategic relationship cooling",
      points: 12,
    })
  }

  if (
    input.opportunityReadinessTier === "priority_opportunity" ||
    (input.engagementTier === "hot" && input.opportunityReadinessTier === "sales_ready")
  ) {
    contributions.push({ kind: "hot_opportunity", label: "Hot opportunity", points: 10 })
  }

  if (isExecutiveCloseCandidate(input)) {
    contributions.push({ kind: "executive_close", label: "Executive close candidate", points: 14 })
  }

  if (
    input.relationshipOwnerAttentionLevel === "critical" ||
    input.relationshipOwnerAttentionLevel === "important"
  ) {
    contributions.push({
      kind: "relationship_attention",
      label: "Relationship owner attention",
      points: input.relationshipOwnerAttentionLevel === "critical" ? 12 : 8,
    })
  }

  if (input.engagementScore != null) {
    contributions.push({
      kind: "engagement",
      label: "Engagement",
      points: Math.round(input.engagementScore * 0.08),
    })
  }

  if (input.opportunityReadinessScore != null) {
    contributions.push({
      kind: "opportunity_readiness",
      label: "Opportunity readiness",
      points: Math.round(input.opportunityReadinessScore * 0.1),
    })
  }

  if (input.revenueProbabilityScore != null) {
    contributions.push({
      kind: "revenue_probability",
      label: "Revenue probability",
      points: Math.round(input.revenueProbabilityScore * 0.12),
    })
  }

  if (fit >= 80) contributions.push({ kind: "high_fit", label: "High fit", points: 8 })

  if (input.momentumTier === "strong" || input.momentumTier === "surging") {
    contributions.push({ kind: "momentum", label: "Strong momentum", points: 6 })
  }

  if (input.workflowHealth === "healthy") {
    contributions.push({ kind: "workflow_healthy", label: "Healthy workflow", points: 4 })
  }

  if (input.opportunityBlockerKeys.includes("suppressed")) {
    contributions.push({ kind: "suppressed", label: "Suppressed", points: -40 })
  }
  if (input.opportunityBlockerKeys.includes("not_interested")) {
    contributions.push({ kind: "not_interested", label: "Not interested", points: -30 })
  }
  if (input.workflowHealth === "stalled" || input.workflowHealth === "blocked") {
    contributions.push({ kind: "workflow_stalled", label: "Stalled workflow", points: -12 })
  }
  if (input.relationshipTrend === "cooling" && input.relationshipStrengthTier !== "strategic") {
    contributions.push({ kind: "relationship_cooling", label: "Relationship cooling", points: -8 })
  }
  if (input.opportunityBlockerKeys.length >= 3) {
    contributions.push({
      kind: "high_blocker_load",
      label: "High blocker load",
      points: -10,
    })
  }

  for (const conflict of conflicts) {
    contributions.push({
      kind: `conflict_${conflict.key}`,
      label: conflict.label,
      points: conflict.severity === "critical" ? -8 : -4,
    })
  }

  let score = 5
  score += contributions.reduce((sum, entry) => sum + entry.points, 0)
  score = clampScore(score)

  let tier = tierFromScore(score)

  const closeCandidate = isExecutiveCloseCandidate(input)
  const regressionRisk =
    input.revenueTrajectory === "at_risk" ||
    conflicts.some((conflict) => conflict.key === "commit_regression_risk")

  if (
    score >= 85 &&
    (input.revenueProbabilityTier === "commit_candidate" ||
      input.forecastAttentionLevel === "critical" ||
      (closeCandidate && regressionRisk))
  ) {
    tier = "executive_now"
  } else if (score >= 70 || (score >= 60 && conflicts.some((c) => c.severity === "critical"))) {
    tier = "priority"
  } else if (
    score >= 45 ||
    input.forecastAttentionLevel === "important" ||
    input.relationshipOwnerAttentionLevel === "important"
  ) {
    tier = "important"
  } else {
    tier = "monitor"
  }

  const topSignals = [...contributions]
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, 4)

  const positive = topSignals.filter((entry) => entry.points > 0).map((entry) => entry.label)
  const summary =
    positive.length > 0
      ? `${tier.replace(/_/g, " ")} — ${positive.join(", ")}`
      : `${tier.replace(/_/g, " ")} — executive signals still forming`

  const recommendation = buildExecutiveRecommendation({
    tier,
    conflicts,
    interventionNeeded,
    closeCandidate,
  })

  const owner =
    tier === "executive_now" || tier === "priority"
      ? input.assignedTo?.trim() || null
      : null

  let interventionOpenedAt = input.previousInterventionOpenedAt
  if (interventionNeeded) {
    interventionOpenedAt = interventionOpenedAt ?? now.toISOString()
  } else {
    interventionOpenedAt = null
  }

  const interventionAgeBucket = computeExecutiveInterventionAgeBucket(interventionOpenedAt, now)

  const volatility = computeExecutivePriorityVolatility({
    previousScore: input.previousExecutiveScore,
    currentScore: score,
    previousTier: input.previousExecutiveTier,
    currentTier: tier,
    previousConflictCount: input.previousConflictCount,
    currentConflictCount: conflicts.length,
    revenueVolatility: input.revenueProbabilityVolatility,
  })

  return {
    score,
    tier,
    summary,
    topSignals,
    volatility,
    conflicts,
    conflictSeverityScore,
    recommendation,
    owner,
    interventionNeeded,
    interventionOpenedAt,
    interventionAgeBucket,
  }
}
