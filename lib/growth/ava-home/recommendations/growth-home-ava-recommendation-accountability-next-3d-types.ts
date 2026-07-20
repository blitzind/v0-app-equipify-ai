/** GE-AIOS-NEXT-3D — Organizational learning loop / recommendation accountability types (client-safe). */

import type { GrowthEvidenceCompletenessClassification } from "@/lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b-types"

export const GROWTH_AIOS_NEXT_3D_RECOMMENDATION_ACCOUNTABILITY_QA_MARKER =
  "ge-aios-next-3d-organizational-learning-loop-v1" as const

export const GROWTH_AIOS_NEXT_3D_ACCOUNTABILITY_PRINCIPLE =
  "Recommendations earn or lose credibility from Production outcomes — not from Ava's confidence alone." as const

export const GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_TYPES = [
  "recommendation_accepted",
  "recommendation_skipped",
  "recommendation_dismissed",
  "recommendation_deferred",
  "strategic_override",
  "objective_adopted",
  "package_approved",
  "package_rejected",
] as const

export type GrowthHomeAvaOperatorDecisionType = (typeof GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_TYPES)[number]

export const GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_METADATA_KEYS = {
  decisionType: "operator_decision_type",
  recommendationTopic: "recommendation_topic",
  recommendationKind: "recommendation_kind",
  recommendationId: "recommendation_id",
  idempotencyKey: "operator_decision_idempotency",
  phase: "ge_aios_phase",
} as const

export const GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_PHASE = "GE-AIOS-NEXT-3D" as const

export type GrowthRecommendationHistoryStage =
  | "created"
  | "accepted"
  | "implemented"
  | "observed_outcome"

export type GrowthRecommendationHistoryStageRecord =
  | {
      stage: GrowthRecommendationHistoryStage
      status: "recorded"
      recordedAt: string | null
      count: number
      source: string
    }
  | {
      stage: GrowthRecommendationHistoryStage
      status: "not_recorded"
      source: string | null
    }
  | {
      stage: GrowthRecommendationHistoryStage
      status: "insufficient_evidence"
      reason: string
    }

export type GrowthRecommendationAccountabilityStatus =
  | "awaiting_operator"
  | "accepted_not_implemented"
  | "implemented_awaiting_outcome"
  | "outcome_observed"
  | "insufficient_history"
  | "dismissed_or_deferred"

export type GrowthRecommendationOutcomeSignal =
  | "admission_improvement"
  | "research_throughput"
  | "decision_maker_readiness"
  | "package_throughput"
  | "approval_throughput"
  | "meeting_progression"
  | "objective_advancement"
  | "runtime_utilization"
  | "business_outcome"

export type GrowthRecommendationOutcomeLinkage = {
  topic: string
  linked: boolean
  signals: Array<{
    signal: GrowthRecommendationOutcomeSignal
    label: string
    value: string | number | null
    evidenceClassification: GrowthEvidenceCompletenessClassification
  }>
  causationNote: string
}

export type GrowthRecommendationConfidenceEvolution =
  | "increasing"
  | "stable"
  | "declining"
  | "insufficient_evidence"
  | "unknown"

export type GrowthRecommendationHistoryRecord = {
  recommendationTopic: string
  recommendationSummary: string | null
  stages: GrowthRecommendationHistoryStageRecord[]
  confidence: "high" | "moderate" | "low" | "insufficient_evidence" | "unknown"
  evidenceQuality: GrowthEvidenceCompletenessClassification
  currentStatus: GrowthRecommendationAccountabilityStatus
}

export type GrowthHomeAvaRecommendationAccountabilitySnapshot = {
  qaMarker: typeof GROWTH_AIOS_NEXT_3D_RECOMMENDATION_ACCOUNTABILITY_QA_MARKER
  principle: typeof GROWTH_AIOS_NEXT_3D_ACCOUNTABILITY_PRINCIPLE
  organizationId: string
  generatedAt: string
  readOnly: true
  primaryTopic: string | null
  organizationalLearningLine: string | null
  confidenceEvolution: GrowthRecommendationConfidenceEvolution
  confidenceEvolutionReason: string
  history: GrowthRecommendationHistoryRecord | null
  outcomeLinkage: GrowthRecommendationOutcomeLinkage | null
  operatorDecisionSummary: {
    durableServerEventsInWindow: number
    browserLocalOnlyNote: string | null
  }
  learningModel: {
    recommendationMade: boolean
    recommendationAccepted: boolean | null
    outcomeObserved: boolean | null
    confidenceAdjusted: boolean
    futureReasoningReady: boolean
  }
}
