import { computeRevenueForecastConfidence } from "@/lib/growth/revenue-forecast-confidence"
import {
  computeForecastAttentionLevel,
  computeForecastContributionWeight,
} from "@/lib/growth/revenue-forecast-contribution"
import {
  computeRevenueProbabilityVolatility,
  computeRevenueTrajectory,
} from "@/lib/growth/revenue-forecast-trajectory"
import type {
  GrowthLeadRevenueForecastInput,
  GrowthLeadRevenueForecastResult,
  GrowthRevenueForecastTopSignal,
  GrowthRevenueProbabilityTier,
} from "@/lib/growth/revenue-forecast-types"
import { CRITICAL_REVENUE_BLOCKER_KEYS } from "@/lib/growth/revenue-forecast-types"

const TERMINAL_STATUSES = new Set(["converted", "disqualified", "archived"])

const TIER_FROM_SCORE: Array<{ min: number; tier: GrowthRevenueProbabilityTier }> = [
  { min: 85, tier: "commit_candidate" },
  { min: 65, tier: "forecasted" },
  { min: 45, tier: "probable" },
  { min: 25, tier: "possible" },
  { min: 0, tier: "unlikely" },
]

const TIER_RANK: Record<GrowthRevenueProbabilityTier, number> = {
  unlikely: 0,
  possible: 1,
  probable: 2,
  forecasted: 3,
  commit_candidate: 4,
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function tierFromScore(score: number): GrowthRevenueProbabilityTier {
  for (const entry of TIER_FROM_SCORE) {
    if (score >= entry.min) return entry.tier
  }
  return "unlikely"
}

function minTier(
  a: GrowthRevenueProbabilityTier,
  b: GrowthRevenueProbabilityTier,
): GrowthRevenueProbabilityTier {
  return TIER_RANK[a] <= TIER_RANK[b] ? a : b
}

function applyCriticalBlockerCeiling(
  tier: GrowthRevenueProbabilityTier,
  blockerKeys: string[],
): GrowthRevenueProbabilityTier {
  const hasCritical = blockerKeys.some((key) =>
    (CRITICAL_REVENUE_BLOCKER_KEYS as Set<string>).has(key),
  )
  if (hasCritical) return minTier(tier, "probable")
  return tier
}

function applyCommitRequirements(
  tier: GrowthRevenueProbabilityTier,
  input: GrowthLeadRevenueForecastInput,
): GrowthRevenueProbabilityTier {
  if (tier !== "commit_candidate") return tier
  const fit = input.fit ?? 0
  const dmConfirmed =
    input.decisionMakerStatus === "confirmed" ||
    input.decisionMakerStatus === "verified_contactable"
  const strongBuying =
    input.opportunityBuyingSignalStrength === "strong" ||
    input.opportunityBuyingSignalStrength === "moderate"
  const strategic = input.relationshipStrengthTier === "strategic"
  if (
    fit < 75 ||
    !dmConfirmed ||
    input.workflowHealth === "stalled" ||
    input.workflowHealth === "blocked" ||
    (!strategic && !strongBuying)
  ) {
    return "forecasted"
  }
  return tier
}

function applyForecastRequirements(
  tier: GrowthRevenueProbabilityTier,
  input: GrowthLeadRevenueForecastInput,
): GrowthRevenueProbabilityTier {
  if (tier !== "forecasted" && tier !== "commit_candidate") return tier
  const dmConfirmed =
    input.decisionMakerStatus === "confirmed" ||
    input.decisionMakerStatus === "verified_contactable"
  if (!dmConfirmed) return minTier(tier, "probable")
  return tier
}

export function computeGrowthLeadRevenueForecast(
  input: GrowthLeadRevenueForecastInput,
): GrowthLeadRevenueForecastResult {
  const blockerKeys = input.opportunityBlockerKeys

  if (TERMINAL_STATUSES.has(input.status)) {
    return {
      score: 0,
      tier: "unlikely",
      summary: "Terminal lead status.",
      topSignals: [],
      confidence: 0,
      trajectory: "steady",
      volatility: 0,
      contributionWeight: 0,
      attentionLevel: "none",
    }
  }

  const contributions: GrowthRevenueForecastTopSignal[] = []
  const fit = input.fit ?? 0

  if (input.opportunityReadinessScore != null) {
    const points = Math.round(input.opportunityReadinessScore * 0.25)
    contributions.push({
      kind: "opportunity_readiness",
      label: "Opportunity readiness",
      points,
    })
  }

  if (input.relationshipStrengthScore != null) {
    const points = Math.round(input.relationshipStrengthScore * 0.15)
    contributions.push({
      kind: "relationship_strength",
      label: "Relationship strength",
      points,
    })
  }

  if (input.engagementScore != null) {
    const points = Math.round(input.engagementScore * 0.1)
    contributions.push({
      kind: "engagement",
      label: "Engagement",
      points,
    })
  }

  if (fit >= 80) contributions.push({ kind: "high_fit", label: "High fit", points: 10 })
  else if (fit >= 60) contributions.push({ kind: "high_fit", label: "Moderate fit", points: 5 })

  if (
    input.decisionMakerStatus === "confirmed" ||
    input.decisionMakerStatus === "verified_contactable"
  ) {
    contributions.push({ kind: "decision_maker_confirmed", label: "Decision maker confirmed", points: 8 })
  }

  if (input.hasPositiveReply) {
    contributions.push({ kind: "positive_reply", label: "Positive reply", points: 10 })
  }

  if (input.connectedCallCount > 0) {
    contributions.push({ kind: "connected_call", label: "Connected call", points: 8 })
  }

  if (input.relationshipStrengthTier === "strategic") {
    contributions.push({ kind: "strategic_relationship", label: "Strategic relationship", points: 10 })
  } else if (input.relationshipStrengthTier === "trusted") {
    contributions.push({ kind: "trusted_relationship", label: "Trusted relationship", points: 6 })
  }

  if (input.opportunityBuyingSignalStrength === "strong") {
    contributions.push({ kind: "buying_signal", label: "Strong buying signal", points: 10 })
  } else if (input.opportunityBuyingSignalStrength === "moderate") {
    contributions.push({ kind: "buying_signal", label: "Moderate buying signal", points: 6 })
  }

  if (input.workflowHealth === "healthy") {
    contributions.push({ kind: "workflow_health", label: "Healthy workflow", points: 5 })
  }

  if (blockerKeys.includes("suppressed")) {
    contributions.push({ kind: "suppressed", label: "Suppressed", points: -50 })
  }
  if (blockerKeys.includes("not_interested")) {
    contributions.push({ kind: "not_interested", label: "Not interested", points: -35 })
  }
  if (input.relationshipTrend === "cooling") {
    contributions.push({ kind: "relationship_cooling", label: "Relationship cooling", points: -10 })
  }
  if (input.workflowHealth === "stalled" || input.workflowHealth === "blocked") {
    contributions.push({ kind: "workflow_stalled", label: "Workflow stalled", points: -12 })
  }
  if (blockerKeys.includes("missing_decision_maker")) {
    contributions.push({ kind: "missing_decision_maker", label: "Missing decision maker", points: -8 })
  }
  if (blockerKeys.includes("multiple_failed_attempts")) {
    contributions.push({ kind: "multiple_failed_attempts", label: "Multiple failed attempts", points: -8 })
  }

  let score = 5
  score += contributions.reduce((sum, entry) => sum + entry.points, 0)

  if (blockerKeys.includes("suppressed")) score = Math.min(score, 15)
  if (blockerKeys.includes("not_interested")) score = Math.min(score, 25)

  score = clampScore(score)
  let tier = tierFromScore(score)
  tier = applyCriticalBlockerCeiling(tier, blockerKeys)
  tier = applyForecastRequirements(tier, input)
  tier = applyCommitRequirements(tier, input)

  const confidence = computeRevenueForecastConfidence(input)
  const trajectory = computeRevenueTrajectory({
    previousScore: input.previousScore,
    currentScore: score,
    previousTier: input.previousTier,
    currentTier: tier,
    opportunityReadinessTrend: input.opportunityReadinessTrend,
    relationshipTrend: input.relationshipTrend,
    workflowHealth: input.workflowHealth,
  })
  const volatility = computeRevenueProbabilityVolatility({
    previousScore: input.previousScore,
    currentScore: score,
    previousConfidence: input.previousConfidence,
    currentConfidence: confidence,
    previousTier: input.previousTier,
    currentTier: tier,
    blockerCount: blockerKeys.length,
  })
  const contributionWeight = computeForecastContributionWeight({
    tier,
    confidence,
    buyingSignalStrength: input.opportunityBuyingSignalStrength,
  })
  const attentionLevel = computeForecastAttentionLevel({
    tier,
    fit,
    confidence,
    trajectory,
    workflowHealth: input.workflowHealth,
    relationshipTrend: input.relationshipTrend,
  })

  const topSignals = [...contributions]
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, 3)

  const tierLabel = tier.replace(/_/g, " ")
  const positive = topSignals.filter((entry) => entry.points > 0).map((entry) => entry.label)
  const summary =
    positive.length > 0
      ? `${tierLabel} — ${positive.join(", ")}`
      : `${tierLabel} — revenue forecast still forming`

  return {
    score,
    tier,
    summary,
    topSignals,
    confidence,
    trajectory,
    volatility,
    contributionWeight,
    attentionLevel,
  }
}
