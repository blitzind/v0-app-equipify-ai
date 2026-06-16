import "server-only"

import { randomUUID } from "node:crypto"
import { extractContentMergeFields } from "@/lib/growth/content/merge-field-validator"
import {
  buildBookingRecommendationPreview,
  buildQuestionPreview,
  buildSafeAnswerPreview,
  normalizeKnowledgeSourceRefs,
  validateKnowledgeSourceRefs,
  validateQaPolicy,
} from "@/lib/growth/media/media-ai-qa-utils"
import { getQaPolicyById } from "@/lib/growth/media/media-ai-qa-policy-types"
import {
  GROWTH_MEDIA_AI_QA_SAFETY_FLAGS,
  type GrowthMediaAiQaProviderStatus,
  type GrowthMediaAiQaSessionCreateInput,
  type GrowthMediaAiQaSessionRecord,
  type GrowthMediaAiQaStatus,
} from "@/lib/growth/media/media-ai-qa-types"

export {
  buildQuestionPreview,
  buildSafeAnswerPreview,
  buildBookingRecommendationPreview,
  validateQaPolicy,
  validateKnowledgeSourceRefs,
} from "@/lib/growth/media/media-ai-qa-utils"

const qaStore = new Map<string, GrowthMediaAiQaSessionRecord>()

function nowIso(): string {
  return new Date().toISOString()
}

export function resetMediaAiQaStoreForCert(): void {
  qaStore.clear()
}

export function mapProviderStatus(providerStatus: GrowthMediaAiQaProviderStatus): GrowthMediaAiQaStatus {
  switch (providerStatus) {
    case "pending":
      return "draft"
    case "ready":
      return "ready"
    case "answered":
      return "ready"
    case "failed":
      return "failed"
    case "cancelled":
      return "cancelled"
    default:
      return "draft"
  }
}

export function createQaSession(input: GrowthMediaAiQaSessionCreateInput): GrowthMediaAiQaSessionRecord {
  if (!input.organizationId.trim()) throw new Error("organization_id_required")
  if (!input.questionTemplate.trim()) throw new Error("question_template_required")

  const policyId = input.policyId ?? "qa-policy-safe-default"
  if (!validateQaPolicy(policyId)) throw new Error("invalid_policy_id")

  const knowledgeSourceRefs = normalizeKnowledgeSourceRefs(input.knowledgeSourceRefs)
  if (!validateKnowledgeSourceRefs(knowledgeSourceRefs)) throw new Error("invalid_knowledge_source_refs")

  const policy = getQaPolicyById(policyId)
  if (!policy) throw new Error("invalid_policy_id")

  const answerPolicy =
    input.fallbackResponse?.trim() != null && input.fallbackResponse.trim().length > 0
      ? { ...policy, fallbackResponse: input.fallbackResponse.trim() }
      : policy

  const personalizationContext = input.personalizationContext ?? {}
  const safeAnswerPreview = buildSafeAnswerPreview({
    policyId,
    fallbackResponse: input.fallbackResponse,
    personalizationContext,
    questionTemplate: input.questionTemplate,
  })
  const bookingPreview = buildBookingRecommendationPreview({
    bookingHandoffEnabled: input.bookingHandoffEnabled,
    qualificationGoal: input.qualificationGoal ?? personalizationContext.qualificationGoal,
    personalizationContext,
    policyId,
  })

  const timestamp = nowIso()
  const record: GrowthMediaAiQaSessionRecord = {
    qaId: randomUUID(),
    organizationId: input.organizationId,
    provider: "foundation",
    status: "draft",
    questionTemplate: input.questionTemplate.trim(),
    answerPolicy: answerPolicy,
    knowledgeSourceRefs,
    mergeFieldsUsed: extractContentMergeFields(input.questionTemplate),
    personalizationContext,
    suggestedAnswer: safeAnswerPreview.previewAnswer,
    bookingRecommendation: bookingPreview.recommendation,
    error: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  qaStore.set(record.qaId, record)
  return record
}

export function getQaSessionStatus(qaId: string, organizationId: string): GrowthMediaAiQaSessionRecord {
  const record = getQaRecordOrThrow(qaId)
  if (record.organizationId !== organizationId) throw new Error("organization_scope_mismatch")
  return record
}

export function cancelQaSession(qaId: string, organizationId: string): GrowthMediaAiQaSessionRecord {
  const record = getQaSessionStatus(qaId, organizationId)
  if (record.status === "cancelled" || record.status === "failed") {
    throw new Error("invalid_status_transition")
  }

  const updated: GrowthMediaAiQaSessionRecord = {
    ...record,
    status: "cancelled",
    updatedAt: nowIso(),
  }
  qaStore.set(updated.qaId, updated)
  return updated
}

function getQaRecordOrThrow(qaId: string): GrowthMediaAiQaSessionRecord {
  const record = qaStore.get(qaId)
  if (!record) throw new Error("qa_session_not_found")
  return record
}

export function toGrowthMediaAiQaResponse(record: GrowthMediaAiQaSessionRecord) {
  const questionPreview = buildQuestionPreview({
    questionTemplate: record.questionTemplate,
    personalizationContext: record.personalizationContext,
  })
  const safeAnswerPreview = buildSafeAnswerPreview({
    policyId: record.answerPolicy.policyId,
    fallbackResponse: record.answerPolicy.fallbackResponse,
    personalizationContext: record.personalizationContext,
    questionTemplate: record.questionTemplate,
  })
  const bookingPreview = buildBookingRecommendationPreview({
    bookingHandoffEnabled: record.bookingRecommendation != null,
    qualificationGoal: record.personalizationContext.qualificationGoal,
    personalizationContext: record.personalizationContext,
    policyId: record.answerPolicy.policyId,
  })

  return {
    ok: true as const,
    qa: record,
    question_preview: questionPreview,
    safe_answer_preview: safeAnswerPreview,
    booking_handoff_preview: bookingPreview,
    ...GROWTH_MEDIA_AI_QA_SAFETY_FLAGS,
  }
}
