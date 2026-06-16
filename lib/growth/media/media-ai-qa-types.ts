/** Growth Engine S2-I — AI Q&A session lifecycle types (foundation only, no LLM/retrieval execution). */

import type { GrowthMediaAiQaAnswerPolicyDefinition } from "@/lib/growth/media/media-ai-qa-policy-types"
import type { GrowthMediaAiQaKnowledgeSourceRef } from "@/lib/growth/media/media-ai-qa-knowledge-types"
import type { GrowthMediaConversationalMeetingRecommendation } from "@/lib/growth/media/media-conversational-session-types"

export const GROWTH_MEDIA_AI_QA_QA_MARKER = "growth-media-ai-qa-s2i-v1" as const

export const GROWTH_MEDIA_AI_QA_PROVIDERS = ["foundation"] as const

export type GrowthMediaAiQaProvider = (typeof GROWTH_MEDIA_AI_QA_PROVIDERS)[number]

export const GROWTH_MEDIA_AI_QA_STATUSES = ["draft", "ready", "answered", "failed", "cancelled"] as const

export type GrowthMediaAiQaStatus = (typeof GROWTH_MEDIA_AI_QA_STATUSES)[number]

export const GROWTH_MEDIA_AI_QA_PROVIDER_STATUSES = [
  "pending",
  "ready",
  "answered",
  "failed",
  "cancelled",
] as const

export type GrowthMediaAiQaProviderStatus = (typeof GROWTH_MEDIA_AI_QA_PROVIDER_STATUSES)[number]

export const GROWTH_MEDIA_AI_QA_SAFETY_FLAGS = {
  provider_execution_enabled: false,
  autonomous_execution_enabled: false,
  no_ai_answer_generated: true,
  no_retrieval_executed: true,
  no_public_qa_widget: true,
  no_notifications: true,
  no_sequence_execution: true,
} as const

export type GrowthMediaAiQaPersonalizationContext = {
  prospectName?: string | null
  companyName?: string | null
  senderName?: string | null
  senderCompany?: string | null
  qualificationGoal?: string | null
  customMergeValues?: Record<string, string>
}

export type GrowthMediaAiQaSessionRecord = {
  qaId: string
  organizationId: string
  provider: GrowthMediaAiQaProvider
  status: GrowthMediaAiQaStatus
  questionTemplate: string
  answerPolicy: GrowthMediaAiQaAnswerPolicyDefinition
  knowledgeSourceRefs: GrowthMediaAiQaKnowledgeSourceRef[]
  mergeFieldsUsed: string[]
  personalizationContext: GrowthMediaAiQaPersonalizationContext
  suggestedAnswer: string | null
  bookingRecommendation: GrowthMediaConversationalMeetingRecommendation | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthMediaAiQaSessionCreateInput = {
  organizationId: string
  policyId?: string | null
  questionTemplate: string
  fallbackResponse?: string | null
  knowledgeSourceRefs?: GrowthMediaAiQaKnowledgeSourceRef[]
  bookingHandoffEnabled?: boolean
  qualificationGoal?: string | null
  personalizationContext?: GrowthMediaAiQaPersonalizationContext
}

export type GrowthMediaAiQaQuestionPreview = {
  questionTemplate: string
  resolvedQuestion: string
  mergeFieldsUsed: string[]
  usedFallback: boolean
}

export type GrowthMediaAiQaSafeAnswerPreview = {
  previewAnswer: string
  usesFallback: boolean
  requiresHumanReview: boolean
  policyId: string
  blockedTopicsApplied: string[]
}

export type GrowthMediaAiQaBookingHandoffPreview = {
  enabled: boolean
  recommendation: GrowthMediaConversationalMeetingRecommendation | null
  handoffReady: boolean
  rationale: string
}
