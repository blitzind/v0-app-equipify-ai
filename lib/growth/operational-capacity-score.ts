import { isExecutiveCloseCandidate } from "@/lib/growth/executive-operating-close-candidate"
import { detectCapacityConflicts } from "@/lib/growth/operational-capacity-conflicts"
import {
  buildOperationalCapacityTopConstraints,
  computePlatformPressureLevel,
  detectOperationalConstraints,
} from "@/lib/growth/operational-capacity-constraints"
import { buildCapacityProtectionRecommendation } from "@/lib/growth/operational-capacity-protection"
import type {
  GrowthConstraintAgeBucket,
  GrowthCapacityRecoveryDirection,
  GrowthLeadOperationalCapacityInput,
  GrowthLeadOperationalCapacityResult,
  GrowthOperationalCapacityTier,
} from "@/lib/growth/operational-capacity-types"

const TERMINAL_STATUSES = new Set(["converted", "disqualified", "archived"])

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function tierFromHeadroom(score: number): GrowthOperationalCapacityTier {
  if (score >= 70) return "healthy"
  if (score >= 50) return "strained"
  if (score >= 30) return "constrained"
  return "critical"
}

export function computeConstraintAgeBucket(
  openedAt: string | null,
  now: Date = new Date(),
): GrowthConstraintAgeBucket {
  if (!openedAt) return "new"
  const opened = Date.parse(openedAt)
  if (Number.isNaN(opened)) return "new"
  const days = (now.getTime() - opened) / (24 * 60 * 60 * 1000)
  if (days <= 3) return "new"
  if (days <= 14) return "active"
  if (days <= 30) return "aging"
  return "stalled"
}

export function computeCapacityRecoveryDirection(input: {
  previousCapacityScore: number | null
  currentCapacityScore: number
  previousPressureLevel: number | null
  currentPressureLevel: number
}): GrowthCapacityRecoveryDirection {
  const scoreDelta =
    input.previousCapacityScore != null
      ? input.currentCapacityScore - input.previousCapacityScore
      : 0
  const pressureDelta =
    input.previousPressureLevel != null
      ? input.currentPressureLevel - input.previousPressureLevel
      : 0

  if (scoreDelta >= 8 || pressureDelta <= -8) return "recovering"
  if (scoreDelta <= -8 || pressureDelta >= 8) return "worsening"
  return "stable"
}

export function computeCapacityPressureVolatility(input: {
  previousPressureLevel: number | null
  currentPressureLevel: number
  previousConstraintCount: number
  currentConstraintCount: number
  previousCapacityTier: GrowthOperationalCapacityTier | null
  currentCapacityTier: GrowthOperationalCapacityTier
}): number {
  let volatility = 0

  if (input.previousPressureLevel != null) {
    volatility += Math.min(40, Math.abs(input.currentPressureLevel - input.previousPressureLevel) * 2)
  }

  volatility += Math.min(20, Math.abs(input.currentConstraintCount - input.previousConstraintCount) * 8)

  if (input.previousCapacityTier && input.previousCapacityTier !== input.currentCapacityTier) {
    volatility += 20
  }

  return Math.min(100, Math.round(volatility))
}

function computeLeadDemandWeight(input: GrowthLeadOperationalCapacityInput): number {
  let demand = 0

  if (input.executivePriorityTier === "executive_now") demand += 12
  else if (input.executivePriorityTier === "priority") demand += 8

  if (input.revenueProbabilityTier === "commit_candidate") demand += 10
  else if (input.revenueProbabilityTier === "forecasted") demand += 6

  if (input.opportunityReadinessTier === "priority_opportunity") demand += 6

  if (
    input.followUpAt &&
    !Number.isNaN(Date.parse(input.followUpAt)) &&
    Date.parse(input.followUpAt) > (input.now ?? new Date()).getTime()
  ) {
    demand += 4
  }

  if (input.callPriorityTier === "critical") demand += 5
  else if (input.callPriorityTier === "high") demand += 3

  if (input.engagementTier === "hot") demand += 4

  return demand
}

function computeProtectedPipelineCoverage(snapshot: GrowthLeadOperationalCapacityInput["snapshot"]): number {
  if (snapshot.protectedPipelineCount <= 0) return 100
  return clampScore(
    Math.round((snapshot.protectedPipelineHealthyCount / snapshot.protectedPipelineCount) * 100),
  )
}

export function isProtectedGrowthOpportunityFromLead(lead: import("@/lib/growth/types").GrowthLead): boolean {
  return (
    lead.revenueProbabilityTier === "commit_candidate" ||
    lead.executivePriorityTier === "executive_now" ||
    isExecutiveCloseCandidate({
      fit: lead.score,
      opportunityReadinessTier: lead.opportunityReadinessTier,
      relationshipStrengthTier: lead.relationshipStrengthTier,
      opportunityBuyingSignalStrength: lead.opportunityBuyingSignalStrength,
      revenueProbabilityTier: lead.revenueProbabilityTier,
      decisionMakerStatus: lead.decisionMakerStatus,
    })
  )
}

export function isProtectedGrowthOpportunity(input: GrowthLeadOperationalCapacityInput): boolean {
  return (
    input.revenueProbabilityTier === "commit_candidate" ||
    input.executivePriorityTier === "executive_now" ||
    isExecutiveCloseCandidate(input)
  )
}

export function computeGrowthLeadOperationalCapacity(
  input: GrowthLeadOperationalCapacityInput,
): GrowthLeadOperationalCapacityResult {
  const now = input.now ?? new Date()
  const constraints = detectOperationalConstraints(input.snapshot)
  const pressureLevel = computePlatformPressureLevel(input.snapshot, constraints)
  const topConstraints = buildOperationalCapacityTopConstraints(input.snapshot, constraints)
  const protectedPipelineCoverage = computeProtectedPipelineCoverage(input.snapshot)
  const isProtectedOpportunity = isProtectedGrowthOpportunity(input)

  if (TERMINAL_STATUSES.has(input.status)) {
    return {
      score: 0,
      tier: "critical",
      summary: "Terminal lead status.",
      topConstraints: [],
      pressureLevel: 0,
      pressureVolatility: 0,
      protectedPipelineCoverage,
      constraints: [],
      conflicts: [],
      protectionRecommendation: "No capacity actions for terminal leads.",
      constraintOpenedAt: null,
      constraintAgeBucket: "new",
      recoveryDirection: "stable",
      isProtectedOpportunity: false,
    }
  }

  const demandWeight = computeLeadDemandWeight(input)
  let score = clampScore(100 - pressureLevel - Math.round(demandWeight * 0.6))
  const tier = tierFromHeadroom(score)

  const conflicts = detectCapacityConflicts({
    snapshot: input.snapshot,
    constraints,
    lead: input,
    pressureLevel,
    tier,
    isProtectedOpportunity,
  })

  if (conflicts.some((entry) => entry.severity === "critical")) {
    score = Math.min(score, 45)
  }

  const finalTier = tierFromHeadroom(score)
  const recoveryDirection = computeCapacityRecoveryDirection({
    previousCapacityScore: input.previousCapacityScore,
    currentCapacityScore: score,
    previousPressureLevel: input.previousPressureLevel,
    currentPressureLevel: pressureLevel,
  })

  const pressureVolatility = computeCapacityPressureVolatility({
    previousPressureLevel: input.previousPressureLevel,
    currentPressureLevel: pressureLevel,
    previousConstraintCount: input.previousConstraintKeys.length,
    currentConstraintCount: constraints.length,
    previousCapacityTier: input.previousCapacityTier,
    currentCapacityTier: finalTier,
  })

  let constraintOpenedAt = input.previousConstraintOpenedAt
  if (constraints.length > 0) {
    constraintOpenedAt = constraintOpenedAt ?? now.toISOString()
  } else {
    constraintOpenedAt = null
  }

  const constraintAgeBucket = computeConstraintAgeBucket(constraintOpenedAt, now)

  const protectionRecommendation = buildCapacityProtectionRecommendation({
    tier: finalTier,
    pressureLevel,
    constraints,
    conflicts,
    isProtectedOpportunity,
    protectedPipelineCoverage,
  })

  const positive = topConstraints.slice(0, 2).map((entry) => entry.label)
  const summary =
    positive.length > 0
      ? `${finalTier} — ${positive.join(", ")}`
      : `${finalTier} — operational capacity stable`

  return {
    score,
    tier: finalTier,
    summary,
    topConstraints,
    pressureLevel,
    pressureVolatility,
    protectedPipelineCoverage,
    constraints,
    conflicts,
    protectionRecommendation,
    constraintOpenedAt,
    constraintAgeBucket,
    recoveryDirection,
    isProtectedOpportunity,
  }
}
