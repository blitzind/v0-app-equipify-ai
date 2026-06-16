/** Growth Engine S2-I — client-safe AI Q&A helpers (no LLM, no retrieval execution). */

import { extractContentMergeFields } from "@/lib/growth/content/merge-field-validator"
import {
  getQaPolicyById,
  validateQaPolicy,
  type GrowthMediaAiQaAnswerPolicyDefinition,
} from "@/lib/growth/media/media-ai-qa-policy-types"
import {
  normalizeKnowledgeSourceRefs,
  validateKnowledgeSourceRefs,
  type GrowthMediaAiQaKnowledgeSourceRef,
} from "@/lib/growth/media/media-ai-qa-knowledge-types"
import type {
  GrowthMediaAiQaBookingHandoffPreview,
  GrowthMediaAiQaPersonalizationContext,
  GrowthMediaAiQaQuestionPreview,
  GrowthMediaAiQaSafeAnswerPreview,
} from "@/lib/growth/media/media-ai-qa-types"
import { evaluateQualificationState } from "@/lib/growth/media/media-conversational-session-utils"
import { applySharePageTemplateMergeFields } from "@/lib/growth/share-pages/share-page-template-instantiation-compile"
import { buildSharePageTemplatePreviewMergeValues } from "@/lib/growth/share-pages/share-page-template-preview-context"

function buildMergeValues(context: GrowthMediaAiQaPersonalizationContext): Record<string, string> {
  return buildSharePageTemplatePreviewMergeValues({
    prospectName: context.prospectName ?? "Prospect",
    companyName: context.companyName ?? "Company",
    senderName: context.senderName ?? "Sender",
    senderCompany: context.senderCompany ?? "Equipify",
    bookingLinkOverride: "",
    customMergeValues: context.customMergeValues ?? {},
    analyticsPreviewMode: true,
    aiVideoPreviewMode: true,
    voiceClonePreviewMode: true,
    conversationalAgentPreviewMode: true,
    aiQaPreviewMode: true,
    bookingHandoffPreviewMode: true,
  })
}

function resolvePolicy(input: {
  policyId?: string | null
  fallbackResponse?: string | null
}): GrowthMediaAiQaAnswerPolicyDefinition {
  const policy = getQaPolicyById(input.policyId) ?? getQaPolicyById("qa-policy-safe-default")
  if (!policy) {
    throw new Error("invalid_policy")
  }
  if (!input.fallbackResponse?.trim()) return policy
  return {
    ...policy,
    fallbackResponse: input.fallbackResponse.trim(),
  }
}

export function buildQuestionPreview(input: {
  questionTemplate: string
  personalizationContext?: GrowthMediaAiQaPersonalizationContext
  fallbackText?: string
}): GrowthMediaAiQaQuestionPreview {
  const mergeFieldsUsed = extractContentMergeFields(input.questionTemplate)
  const mergeValues = buildMergeValues(input.personalizationContext ?? {})
  const resolved = applySharePageTemplateMergeFields(input.questionTemplate, mergeValues).trim()
  const hasUnresolvedTokens = /\{\{/.test(resolved)
  const fallback = input.fallbackText?.trim() || "Personalized Q&A question preview"
  return {
    questionTemplate: input.questionTemplate,
    resolvedQuestion: hasUnresolvedTokens ? fallback : resolved || fallback,
    mergeFieldsUsed,
    usedFallback: hasUnresolvedTokens || !resolved,
  }
}

export function buildSafeAnswerPreview(input: {
  policyId?: string | null
  fallbackResponse?: string | null
  personalizationContext?: GrowthMediaAiQaPersonalizationContext
  questionTemplate?: string | null
}): GrowthMediaAiQaSafeAnswerPreview {
  const policy = resolvePolicy(input)
  const mergeValues = buildMergeValues(input.personalizationContext ?? {})
  const resolvedFallback = applySharePageTemplateMergeFields(policy.fallbackResponse, mergeValues).trim()
  const previewAnswer = resolvedFallback || policy.fallbackResponse
  const question = (input.questionTemplate ?? "").toLowerCase()
  const blockedTopicsApplied = policy.blockedTopics.filter((topic) => question.includes(topic.replace(/_/g, " ")))

  return {
    previewAnswer: previewAnswer.slice(0, policy.maxAnswerLength),
    usesFallback: true,
    requiresHumanReview: policy.requiresHumanReview,
    policyId: policy.policyId,
    blockedTopicsApplied,
  }
}

export function buildBookingRecommendationPreview(input: {
  bookingHandoffEnabled?: boolean
  qualificationGoal?: string | null
  personalizationContext?: GrowthMediaAiQaPersonalizationContext
  policyId?: string | null
}): GrowthMediaAiQaBookingHandoffPreview {
  const policy = resolvePolicy({ policyId: input.policyId })
  const enabled = input.bookingHandoffEnabled === true && policy.allowBookingRecommendation
  const evaluation = evaluateQualificationState({
    qualificationGoal: input.qualificationGoal ?? input.personalizationContext?.qualificationGoal ?? null,
    conversationContext: input.personalizationContext ?? {},
  })

  const handoffReady = enabled && evaluation.meetingRecommendation.recommendBooking
  return {
    enabled,
    recommendation: enabled ? evaluation.meetingRecommendation : null,
    handoffReady,
    rationale: enabled
      ? evaluation.meetingRecommendation.rationale
      : "Booking handoff preview disabled or blocked by answer policy.",
  }
}

export { validateQaPolicy } from "@/lib/growth/media/media-ai-qa-policy-types"
export { validateKnowledgeSourceRefs, normalizeKnowledgeSourceRefs }
export type { GrowthMediaAiQaKnowledgeSourceRef }
