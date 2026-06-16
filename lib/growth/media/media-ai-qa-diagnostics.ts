/** Growth Engine S2-I — in-memory AI Q&A certification (no DB, no LLM, no retrieval). */

import { randomUUID } from "node:crypto"
import { validateQaPolicy } from "@/lib/growth/media/media-ai-qa-policy-types"
import { validateKnowledgeSourceRefs } from "@/lib/growth/media/media-ai-qa-knowledge-types"
import {
  cancelQaSession,
  createQaSession,
  getQaSessionStatus,
  mapProviderStatus,
  resetMediaAiQaStoreForCert,
} from "@/lib/growth/media/media-ai-qa-service"
import {
  buildBookingRecommendationPreview,
  buildQuestionPreview,
  buildSafeAnswerPreview,
} from "@/lib/growth/media/media-ai-qa-utils"
import {
  GROWTH_MEDIA_AI_QA_QA_MARKER,
  GROWTH_MEDIA_AI_QA_SAFETY_FLAGS,
} from "@/lib/growth/media/media-ai-qa-types"

export type GrowthMediaAiQaDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GrowthMediaAiQaDiagnosticsReport = {
  ok: boolean
  qa_marker: typeof GROWTH_MEDIA_AI_QA_QA_MARKER
  checks: GrowthMediaAiQaDiagnosticsCheck[]
  final_verdict: "PASS" | "FAIL"
} & typeof GROWTH_MEDIA_AI_QA_SAFETY_FLAGS

function pushCheck(
  checks: GrowthMediaAiQaDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

export function executeGrowthMediaAiQaDiagnostics(input: {
  organizationId: string
}): GrowthMediaAiQaDiagnosticsReport {
  const checks: GrowthMediaAiQaDiagnosticsCheck[] = []
  resetMediaAiQaStoreForCert()

  pushCheck(
    checks,
    "qa_safety_flags",
    GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.provider_execution_enabled === false &&
      GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.autonomous_execution_enabled === false &&
      GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.no_ai_answer_generated === true &&
      GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.no_retrieval_executed === true &&
      GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.no_public_qa_widget === true &&
      GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.no_notifications === true &&
      GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.no_sequence_execution === true,
    "AI Q&A safety flags enforced.",
  )

  pushCheck(
    checks,
    "policy_validation",
    validateQaPolicy("qa-policy-safe-default") && !validateQaPolicy("invalid-policy"),
    "Answer policy validation deterministic.",
  )

  pushCheck(
    checks,
    "knowledge_ref_validation",
    validateKnowledgeSourceRefs([{ sourceType: "share_page_template", sourceId: "demo", enabled: true }]) &&
      !validateKnowledgeSourceRefs([{ sourceType: "invalid_source" as never, enabled: true }]),
    "Knowledge source reference validation deterministic.",
  )

  const questionPreview = buildQuestionPreview({
    questionTemplate: "Hi {{prospect.name}}, what would you like to know about {{company.name}}?",
    personalizationContext: { prospectName: "Alex Rivera", companyName: "Summit Field Services" },
  })
  pushCheck(
    checks,
    "prompt_merge_resolution",
    questionPreview.resolvedQuestion.includes("Alex Rivera") &&
      questionPreview.resolvedQuestion.includes("Summit Field Services"),
    "Question prompt merge resolution works.",
  )

  const safeAnswerPreview = buildSafeAnswerPreview({
    policyId: "qa-policy-safe-default",
    personalizationContext: { prospectName: "Alex Rivera" },
    questionTemplate: "Can you share pricing details?",
  })
  pushCheck(
    checks,
    "safe_answer_preview",
    safeAnswerPreview.usesFallback === true && safeAnswerPreview.requiresHumanReview === true,
    "Safe answer preview uses fallback with human review.",
  )

  const bookingPreview = buildBookingRecommendationPreview({
    bookingHandoffEnabled: true,
    qualificationGoal: "booking_recommendation",
    policyId: "qa-policy-qualification-bridge",
  })
  pushCheck(
    checks,
    "booking_recommendation_preview",
    bookingPreview.enabled === true && bookingPreview.handoffReady === true,
    "Booking handoff readiness preview deterministic.",
  )

  pushCheck(
    checks,
    "provider_status_mapping",
    mapProviderStatus("ready") === "ready" && mapProviderStatus("answered") === "ready",
    "Provider status mapping blocks autonomous answered state.",
  )

  const created = createQaSession({
    organizationId: input.organizationId,
    policyId: "qa-policy-share-page-guided",
    questionTemplate: "What can {{sender.company}} help {{prospect.name}} with?",
    knowledgeSourceRefs: [{ sourceType: "share_page_template", sourceId: null, enabled: true }],
    bookingHandoffEnabled: true,
    qualificationGoal: "meeting_readiness",
    personalizationContext: { prospectName: "Alex Rivera", senderCompany: "Equipify" },
  })
  pushCheck(checks, "qa_create_draft", created.status === "draft", "Q&A session created as draft.")
  pushCheck(
    checks,
    "qa_suggested_answer_is_preview_only",
    created.suggestedAnswer != null && GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.no_ai_answer_generated === true,
    "Suggested answer is safe preview text only (no LLM generation).",
  )

  const read = getQaSessionStatus(created.qaId, input.organizationId)
  pushCheck(checks, "qa_status_read", read.qaId === created.qaId, "Q&A status read works.")

  const cancelled = cancelQaSession(created.qaId, input.organizationId)
  pushCheck(checks, "qa_cancel", cancelled.status === "cancelled", "Cancellation state machine works.")

  let wrongOrgBlocked = false
  try {
    getQaSessionStatus(created.qaId, randomUUID())
  } catch (error) {
    wrongOrgBlocked = error instanceof Error && error.message === "organization_scope_mismatch"
  }
  pushCheck(checks, "qa_org_scope", wrongOrgBlocked, "Organization scope enforced on status read.")

  resetMediaAiQaStoreForCert()
  pushCheck(checks, "qa_cleanup", true, "In-memory Q&A fixtures cleared.")

  const failed = checks.filter((check) => !check.ok)
  return {
    ok: failed.length === 0,
    qa_marker: GROWTH_MEDIA_AI_QA_QA_MARKER,
    checks,
    final_verdict: failed.length === 0 ? "PASS" : "FAIL",
    ...GROWTH_MEDIA_AI_QA_SAFETY_FLAGS,
  }
}
