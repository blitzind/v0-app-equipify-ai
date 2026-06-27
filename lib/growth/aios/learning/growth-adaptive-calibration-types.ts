/** GE-AI-3D-PROD-2 — Operator-gated adaptive calibration types (client-safe). */

import type { GrowthLearningTargetSystem } from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"

export const GROWTH_AIOS_GE_AI_3D_PROD_2_PHASE = "GE-AI-3D-PROD-2" as const

export const GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER =
  "growth-ge-ai-3d-prod-2-adaptive-calibration-v1" as const

export const GROWTH_ADAPTIVE_CALIBRATION_SCHEMA_MIGRATION =
  "20271001240000_growth_ai_3d_prod_2_adaptive_calibration.sql" as const

export const GROWTH_ADAPTIVE_CALIBRATION_RULE =
  "Adaptive calibration converts durable learning insights into operator-gated proposals — no automatic score, ICP, channel, autonomy, or Core mutation until a future controlled-apply phase." as const

export const GROWTH_ADAPTIVE_CALIBRATION_TARGET_SYSTEMS = [
  "communication_engine",
  "meta_recommender",
  "priority_engine",
  "qualification_agent",
  "research_agent",
  "revenue_director",
  "campaign_optimization",
  "icp_learning",
  "forecasting",
] as const

export type GrowthAdaptiveCalibrationTargetSystem =
  (typeof GROWTH_ADAPTIVE_CALIBRATION_TARGET_SYSTEMS)[number]

export const GROWTH_ADAPTIVE_CALIBRATION_PROPOSAL_TYPES = [
  "adjust_weight",
  "test_variant",
  "pause_strategy",
  "increase_priority",
  "decrease_priority",
  "human_review",
  "monitor_only",
] as const

export type GrowthAdaptiveCalibrationProposalType =
  (typeof GROWTH_ADAPTIVE_CALIBRATION_PROPOSAL_TYPES)[number]

export const GROWTH_ADAPTIVE_CALIBRATION_STATUSES = [
  "proposed",
  "approved",
  "rejected",
  "expired",
  "applied",
  "superseded",
] as const

export type GrowthAdaptiveCalibrationStatus =
  (typeof GROWTH_ADAPTIVE_CALIBRATION_STATUSES)[number]

export const GROWTH_ADAPTIVE_CALIBRATION_RISK_LEVELS = ["low", "medium", "high"] as const

export type GrowthAdaptiveCalibrationRiskLevel =
  (typeof GROWTH_ADAPTIVE_CALIBRATION_RISK_LEVELS)[number]

export type GrowthAdaptiveCalibrationProposedChange = {
  key: string
  currentValue?: number | string | boolean
  proposedValue?: number | string | boolean
  delta?: number
  guardrail?: {
    min?: number
    max?: number
  }
}

export type GrowthAdaptiveCalibrationEvidence = {
  source: string
  label: string
  value?: string | number | boolean
  confidence?: number
}

export type GrowthAdaptiveCalibrationProposal = {
  id: string
  organizationId: string
  sourceInsightId: string
  targetSystem: GrowthAdaptiveCalibrationTargetSystem
  proposalType: GrowthAdaptiveCalibrationProposalType
  status: GrowthAdaptiveCalibrationStatus
  title: string
  summary: string
  proposedChange: GrowthAdaptiveCalibrationProposedChange
  evidence: GrowthAdaptiveCalibrationEvidence[]
  confidence: number
  impact: number
  sampleSize: number
  riskLevel: GrowthAdaptiveCalibrationRiskLevel
  review: {
    requiresOperatorApproval: true
    approvedByUserId?: string
    approvedAt?: string
    rejectedByUserId?: string
    rejectedAt?: string
    rejectionReason?: string
  }
  createdAt: string
  expiresAt?: string
}

export const GROWTH_ADAPTIVE_CALIBRATION_EVENT_TYPES = {
  proposalCreated: "growth.adaptive_calibration.proposal_created",
  proposalApproved: "growth.adaptive_calibration.proposal_approved",
  proposalRejected: "growth.adaptive_calibration.proposal_rejected",
  proposalExpired: "growth.adaptive_calibration.proposal_expired",
} as const

export const GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS = {
  maxWeightDelta: 0.15,
  minWeight: 0.05,
  maxWeight: 0.95,
  minSampleForWeightChange: 3,
} as const

export type GrowthAdaptiveCalibrationReadModel = {
  readOnly: true
  advisoryOnly: true
  noAutoApply: true
  qaMarker: typeof GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_ADAPTIVE_CALIBRATION_RULE
  schemaReady: boolean
  summary: {
    proposedCount: number
    approvedNotAppliedCount: number
    rejectedCount: number
    highestImpactTitle: string | null
    targetSystemsAffected: string[]
    lastGeneratedAt: string | null
  }
  proposals: GrowthAdaptiveCalibrationProposal[]
}

export type GrowthAdaptiveCalibrationAdvisoryContext = {
  topProposal: GrowthAdaptiveCalibrationProposal | null
  proposedCount: number
  approvedPendingApplyCount: number
  highestRiskLevel: GrowthAdaptiveCalibrationRiskLevel | null
}

export function buildAdaptiveCalibrationProposalIdempotencyKey(input: {
  organizationId: string
  sourceInsightId: string
}): string {
  return `calibration-proposal:${input.organizationId}:${input.sourceInsightId}`
}

export function mapLearningTargetToCalibrationTarget(
  target: GrowthLearningTargetSystem,
): GrowthAdaptiveCalibrationTargetSystem {
  if ((GROWTH_ADAPTIVE_CALIBRATION_TARGET_SYSTEMS as readonly string[]).includes(target)) {
    return target as GrowthAdaptiveCalibrationTargetSystem
  }
  return "communication_engine"
}

export function canTransitionAdaptiveCalibrationStatus(
  from: GrowthAdaptiveCalibrationStatus,
  to: GrowthAdaptiveCalibrationStatus,
): boolean {
  if (from === to) return true
  if (from === "proposed") return to === "approved" || to === "rejected" || to === "expired" || to === "superseded"
  if (from === "approved") return to === "applied" || to === "superseded"
  return false
}
