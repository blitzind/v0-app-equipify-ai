/** GE-AIOS-NEXT-3E — Organizational learning certification types (client-safe). */

import type { GrowthRecommendationConfidenceEvolution } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-accountability-next-3d-types"
import type { GrowthRecommendationTopic } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-topic-next-3e-types"
import type { GrowthEvidenceCompletenessClassification } from "@/lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b-types"

export const GROWTH_AIOS_NEXT_3E_ORGANIZATIONAL_LEARNING_CERTIFICATION_QA_MARKER =
  "ge-aios-next-3e-organizational-learning-certification-v1" as const

export const GROWTH_AIOS_NEXT_3E_CERTIFICATION_PRINCIPLE =
  "Certify organizational learning only when Production evidence supports each distinct stage — never collapse into a single successful recommendation event." as const

export const GROWTH_AIOS_NEXT_3E_OPERATOR_DECISION_METADATA_KEYS = {
  implementationAt: "implementation_at",
  attributionWindowId: "attribution_window_id",
  observationWindowStart: "observation_window_start",
} as const

export type GrowthAttributionWindowMaturity =
  | "not_started"
  | "accumulating"
  | "mature"
  | "insufficient_volume"
  | "invalid"
  | "closed"

export type GrowthAttributionTimeWindow = {
  id: string
  label: string
  start: string
  end: string
}

export type GrowthRecommendationAttributionWindow = {
  windowId: string
  topic: GrowthRecommendationTopic
  baselineWindow: GrowthAttributionTimeWindow
  implementationAt: string | null
  observationWindow: GrowthAttributionTimeWindow
  comparisonWindow: GrowthAttributionTimeWindow | null
  maturity: GrowthAttributionWindowMaturity
  maturityReason: string
  minimumSampleRequired: number
  observationSampleSize: number
}

export type GrowthTopicComparisonDirection = "improved" | "declined" | "unchanged" | "unknown"

export type GrowthTopicPeriodComparison = {
  topic: GrowthRecommendationTopic
  metricId: string
  metricLabel: string
  baselineValue: number | null
  observedValue: number | null
  absoluteDelta: number | null
  relativeDeltaPct: number | null
  baselineSampleSize: number
  observationSampleSize: number
  dataCompleteness: GrowthEvidenceCompletenessClassification
  direction: GrowthTopicComparisonDirection
  confidence: "high" | "moderate" | "low" | "insufficient_evidence"
  competingExplanations: string[]
  causationNote: string
  windowMaturity: GrowthAttributionWindowMaturity
  excludesPreImplementationOutcomes: boolean
}

export type GrowthTopicRecommendationCredibility = {
  topic: GrowthRecommendationTopic
  confidenceEvolution: GrowthRecommendationConfidenceEvolution
  acceptedCount: number
  implementedCount: number
  matureOutcomeCount: number
  positiveWindows: number
  neutralWindows: number
  negativeWindows: number
  latestComparison: GrowthTopicPeriodComparison | null
  evidenceQuality: GrowthEvidenceCompletenessClassification
  learningStatement: string
  uncertaintyStatement: string
}

export type GrowthOrganizationalLearningPromotionClassification =
  | "observation"
  | "hypothesis"
  | "tested_recommendation"
  | "supported_learning"
  | "contradicted_learning"
  | "inconclusive_result"

export type GrowthOrganizationalLearningPromotionAssessment = {
  classification: GrowthOrganizationalLearningPromotionClassification
  eligibleForKnowledgePromotion: boolean
  reason: string
  causationBoundary: string
}

export type GrowthOrganizationalLearningCertificationVerdict =
  | "certified"
  | "blocked"
  | "fail"

export type GrowthOrganizationalLearningArchitectureVerdict =
  | "architecturally_complete"
  | "not_complete"

export type GrowthOrganizationalLearningCertificationSnapshot = {
  qaMarker: typeof GROWTH_AIOS_NEXT_3E_ORGANIZATIONAL_LEARNING_CERTIFICATION_QA_MARKER
  principle: typeof GROWTH_AIOS_NEXT_3E_CERTIFICATION_PRINCIPLE
  organizationId: string
  generatedAt: string
  readOnly: true
  certificationVerdict: GrowthOrganizationalLearningCertificationVerdict
  certificationDetail: string
  architectureVerdict: GrowthOrganizationalLearningArchitectureVerdict
  architectureGaps: string[]
  primaryTopic: GrowthRecommendationTopic | null
  primaryTopicCredibility: GrowthTopicRecommendationCredibility | null
  topicCredibility: GrowthTopicRecommendationCredibility[]
  attributionWindows: GrowthRecommendationAttributionWindow[]
  periodComparisons: GrowthTopicPeriodComparison[]
  learningPromotion: GrowthOrganizationalLearningPromotionAssessment
  executiveReasoningLines: string[]
  organizationalLearningLine: string | null
  learningLoop: {
    recommendationCreated: boolean
    operatorAccepted: boolean | null
    implemented: boolean | null
    outcomeObserved: boolean | null
    outcomeCompared: boolean
    correlationEstablished: boolean
    causalEffectKnown: false
    confidenceChanged: boolean
    remainsUncertain: boolean
  }
}

export type GrowthOrganizationalLearningProductionConclusion = {
  topic: GrowthRecommendationTopic | null
  confidenceEvolution: GrowthRecommendationConfidenceEvolution
  matureWindows: number
  summary: string
}
