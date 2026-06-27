/** GE-AI-3D-PROD-2 — Generate calibration proposals from learning insights (client-safe). */

import type { GrowthLearningInsight } from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"
import { GROWTH_LEARNING_MIN_SAMPLE_SIZE } from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"
import {
  GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS,
  type GrowthAdaptiveCalibrationEvidence,
  type GrowthAdaptiveCalibrationProposal,
  type GrowthAdaptiveCalibrationProposalType,
  type GrowthAdaptiveCalibrationRiskLevel,
  mapLearningTargetToCalibrationTarget,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-types"

function insightToEvidence(insight: GrowthLearningInsight): GrowthAdaptiveCalibrationEvidence[] {
  return [
    { source: "learning_insight", label: "insightType", value: insight.insightType, confidence: insight.confidence },
    { source: "learning_insight", label: "sampleSize", value: insight.sampleSize },
    ...insight.evidence.slice(0, 3).map((row) => ({
      source: row.source,
      label: row.label,
      value: row.value,
      confidence: row.confidence,
    })),
  ]
}

function resolveRiskLevel(insight: GrowthLearningInsight): GrowthAdaptiveCalibrationRiskLevel {
  if (insight.insightType === "outbound_risk" && insight.impact >= 0.35) return "high"
  if (insight.sampleSize < GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.minSampleForWeightChange) return "low"
  if (insight.impact >= 0.5) return "high"
  if (insight.impact >= 0.25) return "medium"
  return "low"
}

function clampWeightDelta(delta: number): number {
  const capped = Math.min(
    GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.maxWeightDelta,
    Math.max(-GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.maxWeightDelta, delta),
  )
  return Math.round(capped * 1000) / 1000
}

function resolveProposalType(insight: GrowthLearningInsight): GrowthAdaptiveCalibrationProposalType {
  if (insight.status === "not_enough_data" || insight.sampleSize < GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.minSampleForWeightChange) {
    return "monitor_only"
  }

  switch (insight.recommendedAdjustment) {
    case "test_variant":
      return "test_variant"
    case "pause":
      return "pause_strategy"
    case "human_review":
      return "human_review"
    case "increase_weight":
    case "decrease_weight":
      return "adjust_weight"
    default:
      return "monitor_only"
  }
}

function buildProposedChange(input: {
  insight: GrowthLearningInsight
  proposalType: GrowthAdaptiveCalibrationProposalType
}): GrowthAdaptiveCalibrationProposal["proposedChange"] {
  const { insight, proposalType } = input

  if (proposalType === "monitor_only" || proposalType === "human_review") {
    return {
      key: proposalType === "human_review" ? "operator_review_required" : "monitor_only",
      currentValue: "unchanged",
      proposedValue: "unchanged",
    }
  }

  if (proposalType === "pause_strategy") {
    return {
      key: "outbound_strategy_paused",
      currentValue: false,
      proposedValue: true,
    }
  }

  if (insight.insightType === "channel_performance") {
    const smsOutperforming = insight.title.toLowerCase().includes("sms")
    const current = 0.3
    const rawDelta = smsOutperforming ? 0.05 : -0.05
    const delta = clampWeightDelta(rawDelta)
    const proposed = Math.min(
      GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.maxWeight,
      Math.max(GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.minWeight, current + delta),
    )
    return {
      key: smsOutperforming ? "sms_engagement_weight" : "email_engagement_weight",
      currentValue: current,
      proposedValue: proposed,
      delta,
      guardrail: {
        min: GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.minWeight,
        max: GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.maxWeight,
      },
    }
  }

  if (insight.insightType === "approval_friction") {
    return {
      key: "approval_queue_review_priority",
      currentValue: 0.5,
      proposedValue: 0.65,
      delta: clampWeightDelta(0.05),
      guardrail: { min: 0.1, max: 0.9 },
    }
  }

  return {
    key: "generic_weight_adjustment",
    currentValue: 0.5,
    proposedValue: 0.55,
    delta: clampWeightDelta(0.05),
    guardrail: {
      min: GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.minWeight,
      max: GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.maxWeight,
    },
  }
}

export function generateAdaptiveCalibrationProposalFromInsight(input: {
  organizationId: string
  generatedAt: string
  insight: GrowthLearningInsight
}): GrowthAdaptiveCalibrationProposal | null {
  const { insight } = input
  if (insight.status === "not_enough_data" && insight.sampleSize === 0) return null

  const proposalType = resolveProposalType(insight)
  const proposedChange = buildProposedChange({ insight, proposalType })

  if (proposalType === "adjust_weight" && proposedChange.delta != null) {
    if (Math.abs(proposedChange.delta) > GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.maxWeightDelta) {
      return null
    }
  }

  const expiresAt = new Date(Date.parse(input.generatedAt) + 7 * 24 * 60 * 60 * 1000).toISOString()

  return {
    id: `proposal:${insight.id}`,
    organizationId: input.organizationId,
    sourceInsightId: insight.id,
    targetSystem: mapLearningTargetToCalibrationTarget(insight.targetSystem),
    proposalType,
    status: "proposed",
    title: `Calibration: ${insight.title}`,
    summary: `${insight.summary} Operator approval required — no automatic apply.`,
    proposedChange,
    evidence: insightToEvidence(insight),
    confidence: insight.confidence,
    impact: insight.impact,
    sampleSize: insight.sampleSize,
    riskLevel: resolveRiskLevel(insight),
    review: { requiresOperatorApproval: true },
    createdAt: input.generatedAt,
    expiresAt,
  }
}

export function generateAdaptiveCalibrationProposalsFromInsights(input: {
  organizationId: string
  generatedAt: string
  insights: GrowthLearningInsight[]
}): GrowthAdaptiveCalibrationProposal[] {
  return input.insights
    .map((insight) =>
      generateAdaptiveCalibrationProposalFromInsight({
        organizationId: input.organizationId,
        generatedAt: input.generatedAt,
        insight,
      }),
    )
    .filter((row): row is GrowthAdaptiveCalibrationProposal => row !== null)
}

export function validateAdaptiveCalibrationGuardrails(
  proposal: GrowthAdaptiveCalibrationProposal,
): { ok: true } | { ok: false; reason: string } {
  if (proposal.proposalType === "adjust_weight") {
    if (proposal.sampleSize < GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.minSampleForWeightChange) {
      return { ok: false, reason: "insufficient_sample_size" }
    }
    const delta = proposal.proposedChange.delta
    if (delta != null && Math.abs(delta) > GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.maxWeightDelta) {
      return { ok: false, reason: "delta_exceeds_guardrail" }
    }
    const proposed = proposal.proposedChange.proposedValue
    if (typeof proposed === "number") {
      if (proposed < GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.minWeight) {
        return { ok: false, reason: "proposed_below_min" }
      }
      if (proposed > GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.maxWeight) {
        return { ok: false, reason: "proposed_above_max" }
      }
    }
  }
  return { ok: true }
}
