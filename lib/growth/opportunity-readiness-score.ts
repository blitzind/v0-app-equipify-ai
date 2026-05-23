import { daysSince } from "@/lib/growth/engagement-decay"
import { deriveOpportunityAccelerators } from "@/lib/growth/opportunity-accelerators"
import { computeOpportunityAgeBucket } from "@/lib/growth/opportunity-age-bucket"
import { deriveOpportunityBlockers } from "@/lib/growth/opportunity-blockers"
import {
  computeOpportunityReadinessTrend,
  minOpportunityReadinessTier,
} from "@/lib/growth/opportunity-trend"
import type {
  GrowthLeadOpportunityReadinessInput,
  GrowthLeadOpportunityReadinessResult,
  GrowthOpportunityBlocker,
  GrowthOpportunityBuyingSignalStrength,
  GrowthOpportunityReadinessTier,
  GrowthOpportunityTopSignal,
} from "@/lib/growth/opportunity-types"
import { CRITICAL_OPPORTUNITY_BLOCKER_KEYS } from "@/lib/growth/opportunity-types"

const TERMINAL_STATUSES = new Set(["converted", "disqualified", "archived"])

const TIER_FROM_SCORE: Array<{ min: number; tier: GrowthOpportunityReadinessTier }> = [
  { min: 85, tier: "priority_opportunity" },
  { min: 65, tier: "sales_ready" },
  { min: 45, tier: "qualified" },
  { min: 20, tier: "developing" },
  { min: 0, tier: "not_ready" },
]

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function clampConfidence(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function tierFromScore(score: number): GrowthOpportunityReadinessTier {
  for (const entry of TIER_FROM_SCORE) {
    if (score >= entry.min) return entry.tier
  }
  return "not_ready"
}

function applyCriticalBlockerCeiling(
  tier: GrowthOpportunityReadinessTier,
  blockers: GrowthOpportunityBlocker[],
): GrowthOpportunityReadinessTier {
  const hasCritical = blockers.some((blocker) =>
    (CRITICAL_OPPORTUNITY_BLOCKER_KEYS as Set<string>).has(blocker.key),
  )
  if (hasCritical) {
    return minOpportunityReadinessTier(tier, "qualified")
  }
  return tier
}

function applyPriorityRequirements(
  tier: GrowthOpportunityReadinessTier,
  input: GrowthLeadOpportunityReadinessInput,
): GrowthOpportunityReadinessTier {
  if (tier !== "priority_opportunity") return tier
  const fit = input.fit ?? 0
  const dmConfirmed =
    input.decisionMakerStatus === "confirmed" ||
    input.decisionMakerStatus === "verified_contactable"
  const hotOrStrategic =
    input.engagementTier === "hot" || input.relationshipStrengthTier === "strategic"
  if (fit < 75 || !dmConfirmed || !hotOrStrategic) {
    return "sales_ready"
  }
  return tier
}

function computeManualTouchFrequencyPoints(lastHumanTouchAt: string | null, now: Date): number {
  if (!lastHumanTouchAt) return 0
  const days = daysSince(lastHumanTouchAt, now)
  if (days <= 7) return 6
  if (days <= 21) return 4
  if (days <= 45) return 3
  return 0
}

function computeBuyingSignalStrength(
  input: GrowthLeadOpportunityReadinessInput,
  accelerators: GrowthLeadOpportunityReadinessResult["accelerators"],
): GrowthOpportunityBuyingSignalStrength {
  const buyingKeys = new Set([
    "positive_reply",
    "connected_call",
    "hot_engagement",
    "decision_maker_confirmed",
    "strategic_relationship",
  ])
  const count = accelerators.filter((entry) => buyingKeys.has(entry.key)).length

  if (
    input.hasPositiveReply &&
    input.connectedCallCount > 0 &&
    (input.decisionMakerStatus === "confirmed" ||
      input.decisionMakerStatus === "verified_contactable")
  ) {
    return "strong"
  }
  if (count >= 4) return "strong"
  if (count >= 2) return "moderate"
  if (count >= 1) return "weak"
  return "none"
}

function computeReadinessConfidence(input: {
  researchConfidence: number | null
  hasUsableResearch: boolean
  accelerators: GrowthLeadOpportunityReadinessResult["accelerators"]
  blockers: GrowthOpportunityBlocker[]
  engagementScore: number | null
  relationshipStrengthScore: number | null
}): number {
  let confidence = 35
  confidence += Math.round((input.researchConfidence ?? 0) * 25)
  if (input.hasUsableResearch) confidence += 10
  confidence += Math.min(20, input.accelerators.length * 4)
  confidence -= Math.min(25, input.blockers.length * 4)
  if (input.engagementScore != null) confidence += 5
  if (input.relationshipStrengthScore != null) confidence += 5
  return clampConfidence(confidence)
}

export function computeGrowthLeadOpportunityReadiness(
  input: GrowthLeadOpportunityReadinessInput,
): GrowthLeadOpportunityReadinessResult {
  const now = input.now ?? new Date()
  const blockers = deriveOpportunityBlockers(input)
  const accelerators = deriveOpportunityAccelerators(input)

  if (TERMINAL_STATUSES.has(input.status)) {
    return {
      score: 0,
      tier: "not_ready",
      summary: "Terminal lead status.",
      topSignals: [],
      blockers,
      accelerators,
      trend: "stable",
      buyingSignalStrength: "none",
      confidence: 0,
      ageBucket: "stalled",
    }
  }

  const contributions: GrowthOpportunityTopSignal[] = []
  const fit = input.fit ?? 0

  if (fit >= 80) contributions.push({ kind: "high_fit", label: "High fit", points: 15 })
  else if (fit >= 60) contributions.push({ kind: "high_fit", label: "Moderate fit", points: 8 })

  if (input.engagementTier === "hot") {
    contributions.push({ kind: "hot_engagement", label: "Hot engagement", points: 12 })
  } else if (input.engagementTier === "engaged") {
    contributions.push({ kind: "engaged", label: "Engaged lead", points: 6 })
  }

  if (input.relationshipStrengthTier === "strategic") {
    contributions.push({ kind: "strategic_relationship", label: "Strategic relationship", points: 15 })
  } else if (input.relationshipStrengthTier === "trusted") {
    contributions.push({ kind: "trusted_relationship", label: "Trusted relationship", points: 10 })
  }

  if (input.hasPositiveReply) {
    contributions.push({ kind: "positive_reply", label: "Positive reply", points: 18 })
  }

  if (input.connectedCallCount > 0) {
    contributions.push({ kind: "connected_call", label: "Connected call", points: 12 })
  }

  if (
    input.decisionMakerStatus === "confirmed" ||
    input.decisionMakerStatus === "verified_contactable"
  ) {
    contributions.push({ kind: "decision_maker_confirmed", label: "Decision maker confirmed", points: 10 })
  }

  const researchConfidence = input.researchConfidence ?? 0
  if (researchConfidence >= 0.7) {
    contributions.push({ kind: "research_confidence", label: "Strong research confidence", points: 8 })
  } else if (researchConfidence >= 0.4) {
    contributions.push({ kind: "research_confidence", label: "Moderate research confidence", points: 4 })
  }

  const manualTouchPoints = computeManualTouchFrequencyPoints(input.lastHumanTouchAt, now)
  if (manualTouchPoints > 0) {
    contributions.push({
      kind: "manual_touch_frequency",
      label: "Recent manual touches",
      points: manualTouchPoints,
    })
  }

  if (
    (input.relationshipStrengthScore ?? 0) >= 40 &&
    accelerators.some((entry) => entry.key === "multiple_meaningful_touches")
  ) {
    contributions.push({
      kind: "multiple_meaningful_touches",
      label: "Multiple meaningful touches",
      points: 8,
    })
  }

  if (input.isSuppressed) {
    contributions.push({ kind: "suppressed", label: "Suppressed", points: -50 })
  }
  if (input.hasNotInterestedReply) {
    contributions.push({ kind: "not_interested", label: "Not interested", points: -30 })
  }
  if (input.relationshipTrend === "cooling") {
    contributions.push({ kind: "relationship_cooling", label: "Relationship cooling", points: -12 })
  }

  const lastActivity =
    input.engagementLastActivityAt ??
    input.relationshipLastMeaningfulTouchAt ??
    input.lastHumanTouchAt
  if (!lastActivity || daysSince(lastActivity, now) > 45) {
    contributions.push({ kind: "long_inactivity", label: "Long inactivity", points: -15 })
  }

  const failedAttempts = input.callAttemptCount + input.voicemailCount
  if (failedAttempts >= 3 && input.connectedCallCount === 0) {
    contributions.push({
      kind: "multiple_failed_attempts",
      label: "Multiple failed attempts",
      points: -10,
    })
  }

  if (blockers.some((entry) => entry.key === "missing_decision_maker")) {
    contributions.push({ kind: "missing_decision_maker", label: "Missing decision maker", points: -8 })
  }
  if (blockers.some((entry) => entry.key === "no_phone")) {
    contributions.push({ kind: "no_phone", label: "No phone", points: -6 })
  }
  if (blockers.some((entry) => entry.key === "missing_website")) {
    contributions.push({ kind: "missing_website", label: "Missing website", points: -4 })
  }
  if (blockers.some((entry) => entry.key === "insufficient_research")) {
    contributions.push({ kind: "insufficient_research", label: "Insufficient research", points: -10 })
  }

  let score = 5
  score += contributions.reduce((sum, entry) => sum + entry.points, 0)

  if (input.isSuppressed) score = Math.min(score, 10)
  if (input.hasNotInterestedReply) score = Math.min(score, 25)

  score = clampScore(score)
  let tier = tierFromScore(score)
  tier = applyCriticalBlockerCeiling(tier, blockers)
  tier = applyPriorityRequirements(tier, input)

  const topSignals = [...contributions]
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, 3)

  const buyingSignalStrength = computeBuyingSignalStrength(input, accelerators)
  const confidence = computeReadinessConfidence({
    researchConfidence: input.researchConfidence,
    hasUsableResearch: input.hasUsableResearch,
    accelerators,
    blockers,
    engagementScore: input.engagementScore,
    relationshipStrengthScore: input.relationshipStrengthScore,
  })

  const trend = computeOpportunityReadinessTrend({
    previousScore: input.previousScore,
    currentScore: score,
    previousTrend: input.previousTrend,
    newCriticalBlocker: false,
    resolvedCriticalBlocker: false,
  })

  const ageBucket = computeOpportunityAgeBucket({
    createdAt: input.createdAt,
    tier,
    trend,
    engagementLastActivityAt: input.engagementLastActivityAt,
    relationshipLastMeaningfulTouchAt: input.relationshipLastMeaningfulTouchAt,
    now,
  })

  const tierLabel = tier.replace(/_/g, " ")
  const topPositive = topSignals.filter((entry) => entry.points > 0).map((entry) => entry.label)
  const topBlocker = blockers[0]?.label
  const summary =
    topBlocker && tier !== "priority_opportunity"
      ? `${tierLabel} — ${topPositive.join(", ") || "building signals"}; blocker: ${topBlocker.toLowerCase()}`
      : topPositive.length > 0
        ? `${tierLabel} — ${topPositive.join(", ")}`
        : `${tierLabel} — opportunity readiness still forming`

  return {
    score,
    tier,
    summary,
    topSignals,
    blockers,
    accelerators,
    trend,
    buyingSignalStrength,
    confidence,
    ageBucket,
  }
}
