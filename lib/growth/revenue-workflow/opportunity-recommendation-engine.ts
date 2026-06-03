/** Sprint 4 — scored opportunity recommendations (human confirmation required). */

import type { DetectedOpportunitySignal } from "@/lib/growth/opportunity-intelligence/signal-detector"
import { toEvidenceSnippets } from "@/lib/growth/opportunity-intelligence/signal-detector"
import type { GrowthOpportunityRecommendationScore } from "@/lib/growth/revenue-workflow/revenue-workflow-types"

export type OpportunityRecommendationContext = {
  signals: DetectedOpportunitySignal[]
  memory?: {
    available: boolean
    relationshipStage: string | null
    unresolvedObjectionCount: number
    riskFlags: string[]
    commitmentSummaries: string[]
    memoryCoverageScore: number | null
    topObjections: string[]
    engagementTrend: string | null
  }
  replyIntelligence?: {
    intent: string | null
    buyingSignalCount: number
    objectionCount: number
    confidenceTier: string | null
  }
  engagement?: {
    replyCount30d: number
    hasPositiveReply: boolean
    connectedCallCount: number
  }
  opportunityReadinessScore?: number | null
  revenueReadinessScore?: number | null
}

const SIGNAL_WEIGHTS: Partial<Record<DetectedOpportunitySignal["signalType"], number>> = {
  meeting_interest: 22,
  proposal_request: 28,
  budget_signal: 18,
  pricing_interest: 20,
  timeline_interest: 14,
  urgency_signal: 16,
  decision_maker_detected: 12,
  committee_detected: 10,
  competitive_signal: -8,
  technical_validation: 12,
}

const CONFIDENCE_FROM_SCORE: Array<{ min: number; label: GrowthOpportunityRecommendationScore["confidenceLabel"] }> = [
  { min: 75, label: "high" },
  { min: 50, label: "medium" },
  { min: 0, label: "low" },
]

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function confidenceLabel(score: number): GrowthOpportunityRecommendationScore["confidenceLabel"] {
  for (const entry of CONFIDENCE_FROM_SCORE) {
    if (score >= entry.min) return entry.label
  }
  return "low"
}

function resolveRecommendedStage(input: OpportunityRecommendationContext, score: number): string {
  const types = new Set(input.signals.map((signal) => signal.signalType))
  if (types.has("proposal_request") || score >= 80) return "proposal"
  if (types.has("meeting_interest") || types.has("pricing_interest")) return "evaluation"
  if (input.memory?.relationshipStage === "opportunity") return "qualified"
  if (input.memory?.relationshipStage === "evaluating") return "discovery"
  if (score >= 55) return "qualified"
  return "discovery"
}

function resolveValueRange(input: OpportunityRecommendationContext, score: number): { min: number; max: number } {
  const types = new Set(input.signals.map((signal) => signal.signalType))
  let min = 5000
  let max = 15000
  if (types.has("budget_signal") || types.has("pricing_interest")) {
    min = 12000
    max = 45000
  }
  if (types.has("proposal_request")) {
    min = 25000
    max = 85000
  }
  if (score >= 75) {
    min = Math.round(min * 1.2)
    max = Math.round(max * 1.25)
  }
  if ((input.memory?.unresolvedObjectionCount ?? 0) > 0) {
    max = Math.round(max * 0.85)
  }
  return { min, max }
}

export function scoreOpportunityRecommendation(
  input: OpportunityRecommendationContext,
): GrowthOpportunityRecommendationScore {
  const types = new Set(input.signals.map((signal) => signal.signalType))
  const evidence = toEvidenceSnippets(input.signals)
  const supportingEvidence: string[] = evidence.map((entry) => entry.snippet)

  let score = 0
  for (const signal of input.signals) {
    const base = SIGNAL_WEIGHTS[signal.signalType] ?? 6
    const confidenceBoost =
      signal.confidence === "verified" ? 1.2 : signal.confidence === "high" ? 1.1 : signal.confidence === "low" ? 0.8 : 1
    score += base * confidenceBoost
  }

  if (input.engagement?.hasPositiveReply) score += 12
  if ((input.engagement?.replyCount30d ?? 0) >= 2) score += 8
  if ((input.engagement?.connectedCallCount ?? 0) > 0) score += 10
  if ((input.replyIntelligence?.buyingSignalCount ?? 0) > 0) score += input.replyIntelligence!.buyingSignalCount * 5
  if (input.opportunityReadinessScore != null) score += input.opportunityReadinessScore * 0.15
  if (input.revenueReadinessScore != null) score += input.revenueReadinessScore * 0.12

  if (input.memory?.available) {
    if (input.memory.relationshipStage === "evaluating") score += 10
    if (input.memory.relationshipStage === "opportunity") score += 18
    if ((input.memory.commitmentSummaries?.length ?? 0) > 0) score += 8
    if ((input.memory.memoryCoverageScore ?? 0) >= 50) score += 6
    if (input.memory.engagementTrend === "stable" || input.memory.engagementTrend === "warming") score += 5
    score -= (input.memory.unresolvedObjectionCount ?? 0) * 6
    score -= (input.memory.riskFlags?.length ?? 0) * 4
    for (const objection of input.memory.topObjections.slice(0, 2)) {
      supportingEvidence.push(`Memory objection: ${objection.slice(0, 120)}`)
    }
    for (const commitment of input.memory.commitmentSummaries.slice(0, 2)) {
      supportingEvidence.push(`Commitment: ${commitment.slice(0, 120)}`)
    }
  }

  if ((input.replyIntelligence?.objectionCount ?? 0) > 0) score -= 8
  if (types.has("competitive_signal")) score -= 6

  const opportunityScore = clamp(score)
  const confidence = clamp(
    opportunityScore * 0.6 +
      (input.memory?.memoryCoverageScore ?? 30) * 0.2 +
      (input.replyIntelligence?.confidenceTier === "high" ? 15 : input.replyIntelligence?.confidenceTier === "medium" ? 8 : 0),
  )

  const stage = resolveRecommendedStage(input, opportunityScore)
  const valueRange = resolveValueRange(input, opportunityScore)

  return {
    opportunityScore,
    confidence,
    recommendedStage: stage,
    recommendedValueMin: valueRange.min,
    recommendedValueMax: valueRange.max,
    supportingEvidence: [...new Set(supportingEvidence)].slice(0, 8),
    confidenceLabel: confidenceLabel(confidence),
  }
}
