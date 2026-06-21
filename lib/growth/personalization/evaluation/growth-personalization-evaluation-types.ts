/** GS-AI-PLAYBOOK-1E — Personalization evaluation types (client-safe). */

import type {
  GrowthPersonalizationGenerationStatus,
  GrowthPersonalizationNegativeFeedbackReason,
  GrowthPersonalizationOperatorEvaluationSentiment,
  GrowthPersonalizationRegenerationFeedbackCategory,
} from "@/lib/growth/personalization/personalization-types"
import { GROWTH_PERSONALIZATION_EVALUATION_QA_MARKER } from "@/lib/growth/personalization/personalization-types"

export {
  GROWTH_PERSONALIZATION_EVALUATION_QA_MARKER,
  GROWTH_PERSONALIZATION_NEGATIVE_FEEDBACK_REASONS,
} from "@/lib/growth/personalization/personalization-types"

export type {
  GrowthPersonalizationNegativeFeedbackReason,
  GrowthPersonalizationOperatorEvaluationSentiment,
} from "@/lib/growth/personalization/personalization-types"

export type GrowthPersonalizationEvaluationGenerationRecord = {
  id: string
  leadId: string
  status: GrowthPersonalizationGenerationStatus
  personalizationScore: number
  evidenceCoverageScore: number
  subject: string
  createdAt: string
  approvedAt: string | null
  rejectedAt: string | null
  industryId: string | null
  industryLabel: string | null
  isRegeneration: boolean
  regenerationCategory: GrowthPersonalizationRegenerationFeedbackCategory | null
  rejectionCategory: GrowthPersonalizationRegenerationFeedbackCategory | null
  evidenceClaimKeys: string[]
  playbookElementKeys: string[]
  operatorSentiment: GrowthPersonalizationOperatorEvaluationSentiment | null
  operatorNegativeReason: GrowthPersonalizationNegativeFeedbackReason | null
  operatorFeedbackNote: string | null
}

export type GrowthPersonalizationEvaluationOverview = {
  generationCount: number
  approvalCount: number
  rejectionCount: number
  regenerationCount: number
  draftCount: number
  approvalRate: number
  rejectionRate: number
  regenerationRate: number
  avgEvidenceCoverage: number
  avgPersonalizationScore: number
  avgTimeToApprovalMs: number | null
  helpfulCount: number
  notHelpfulCount: number
}

export type GrowthPersonalizationIndustryMetrics = {
  industryId: string
  industryLabel: string
  generationCount: number
  approvalCount: number
  rejectionCount: number
  regenerationCount: number
  approvalRate: number
  avgEvidenceCoverage: number
  avgPersonalizationScore: number
  topRejectionReason: string | null
  topCta: string | null
}

export type GrowthPersonalizationPlaybookElementStat = {
  elementKey: string
  elementLabel: string
  elementKind: "pain" | "discovery_question" | "video_storyline" | "capability_mapping" | "cta" | "other"
  usedCount: number
  approvedCount: number
  rejectedCount: number
  regeneratedCount: number
  approvalRate: number
}

export type GrowthPersonalizationPlaybookAnalytics = {
  industryId: string
  industryLabel: string
  pains: GrowthPersonalizationPlaybookElementStat[]
  discoveryQuestions: GrowthPersonalizationPlaybookElementStat[]
  videoStorylines: GrowthPersonalizationPlaybookElementStat[]
  capabilityMappings: GrowthPersonalizationPlaybookElementStat[]
  ctas: GrowthPersonalizationPlaybookElementStat[]
}

export type GrowthPersonalizationFeedbackInsight = {
  reason: string
  label: string
  count: number
  share: number
}

export type GrowthPersonalizationEvaluationRecommendation = {
  industryId: string
  industryLabel: string
  elementKey: string
  elementLabel: string
  elementKind: GrowthPersonalizationPlaybookElementStat["elementKind"]
  action: "promote" | "demote" | "enrich" | "review"
  approvalRate: number
  sampleCount: number
  rationale: string
}

export type GrowthPersonalizationEvaluationReport = {
  qaMarker: typeof GROWTH_PERSONALIZATION_EVALUATION_QA_MARKER
  generatedAt: string
  overview: GrowthPersonalizationEvaluationOverview
  industries: GrowthPersonalizationIndustryMetrics[]
  playbookAnalytics: GrowthPersonalizationPlaybookAnalytics[]
  feedbackInsights: GrowthPersonalizationFeedbackInsight[]
  recommendations: GrowthPersonalizationEvaluationRecommendation[]
}
