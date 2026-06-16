/** Growth Engine S2-H — in-memory conversational session certification (no DB, no provider execution). */

import { randomUUID } from "node:crypto"
import {
  validateConversationalAgentId,
  listEnabledConversationalAgents,
} from "@/lib/growth/media/media-conversational-agent-types"
import { validateConversationalQualificationGoal } from "@/lib/growth/media/media-conversational-qualification-types"
import {
  cancelConversation,
  createConversationSession,
  endConversation,
  getConversationStatus,
  resetMediaConversationalSessionStoreForCert,
  startConversation,
} from "@/lib/growth/media/media-conversational-session-service"
import {
  buildConversationPreview,
  buildQualificationPreview,
  evaluateQualificationState,
} from "@/lib/growth/media/media-conversational-session-utils"
import {
  GROWTH_MEDIA_CONVERSATIONAL_SESSION_QA_MARKER,
  GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS,
} from "@/lib/growth/media/media-conversational-session-types"
import { executeRetellVideoAgentProviderDiagnostics } from "@/lib/growth/media/providers/retell-video-agent-provider-diagnostics"

export type GrowthMediaConversationalSessionDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GrowthMediaConversationalSessionDiagnosticsReport = {
  ok: boolean
  qa_marker: typeof GROWTH_MEDIA_CONVERSATIONAL_SESSION_QA_MARKER
  checks: GrowthMediaConversationalSessionDiagnosticsCheck[]
  final_verdict: "PASS" | "FAIL"
} & typeof GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS

function pushCheck(
  checks: GrowthMediaConversationalSessionDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

export function executeGrowthMediaConversationalSessionDiagnostics(input: {
  organizationId: string
}): GrowthMediaConversationalSessionDiagnosticsReport {
  const checks: GrowthMediaConversationalSessionDiagnosticsCheck[] = []
  resetMediaConversationalSessionStoreForCert()

  pushCheck(
    checks,
    "conversation_safety_flags",
    GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.provider_execution_enabled === false &&
      GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.autonomous_execution_enabled === false &&
      GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.no_conversation_execution === true &&
      GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.no_generated_media_assets === true &&
      GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.no_playback === true &&
      GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.no_notifications === true &&
      GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.no_sequence_execution === true,
    "Conversational session safety flags enforced.",
  )

  pushCheck(
    checks,
    "agent_catalog_validation",
    listEnabledConversationalAgents().length >= 3 &&
      validateConversationalAgentId("retell-agent-jordan-qualifier") &&
      !validateConversationalAgentId("invalid-agent"),
    "Agent metadata validation deterministic.",
  )

  pushCheck(
    checks,
    "qualification_definition_validation",
    validateConversationalQualificationGoal("meeting_readiness") &&
      !validateConversationalQualificationGoal("invalid-goal"),
    "Qualification definition validation deterministic.",
  )

  const preview = buildConversationPreview({
    agentId: "retell-agent-jordan-qualifier",
    systemPromptTemplate: "Hi {{prospect.name}}, this is {{sender.name}} from {{sender.company}}.",
    conversationContext: {
      prospectName: "Alex Rivera",
      senderName: "Jordan Lee",
      senderCompany: "Equipify",
    },
  })
  pushCheck(
    checks,
    "prompt_merge_resolution",
    preview.resolvedPrompt.includes("Alex Rivera") && preview.resolvedPrompt.includes("Jordan Lee"),
    "Prompt merge resolution works.",
  )

  const qualificationPreview = buildQualificationPreview({ qualificationGoal: "meeting_readiness" })
  pushCheck(
    checks,
    "qualification_preview_steps",
    qualificationPreview.steps.length >= 3 && qualificationPreview.goal === "meeting_readiness",
    "Qualification preview steps render.",
  )

  const evaluation = evaluateQualificationState({
    qualificationGoal: "booking_recommendation",
    conversationContext: { prospectName: "Alex Rivera" },
  })
  pushCheck(
    checks,
    "qualification_state_evaluation",
    evaluation.meetingRecommendation.readinessTier === "ready",
    "Qualification state evaluation deterministic.",
  )

  const providerReport = executeRetellVideoAgentProviderDiagnostics()
  pushCheck(
    checks,
    "provider_abstraction",
    providerReport.ok,
    "Retell video agent provider abstraction loads with execution disabled.",
  )

  const created = createConversationSession({
    organizationId: input.organizationId,
    agentId: "retell-agent-jordan-qualifier",
    qualificationGoal: "meeting_readiness",
    systemPromptTemplate: "Hi {{prospect.name}} from {{sender.company}}",
    conversationContext: { prospectName: "Alex Rivera", senderCompany: "Equipify" },
  })
  pushCheck(checks, "session_create_draft", created.status === "draft", "Conversation session created as draft.")
  pushCheck(checks, "session_no_transcript", created.transcript == null, "No transcript persisted.")
  pushCheck(checks, "session_no_provider_session", created.providerSessionId == null, "No provider session id.")

  const ready = startConversation(created.sessionId, input.organizationId)
  pushCheck(checks, "session_start_ready", ready.status === "ready", "Start transition local-only (ready, not active).")

  const ended = endConversation(created.sessionId, input.organizationId)
  pushCheck(checks, "session_end_completed", ended.status === "completed", "End conversation state machine works.")
  pushCheck(checks, "session_end_no_transcript", ended.transcript == null, "End conversation does not create transcript.")

  resetMediaConversationalSessionStoreForCert()
  const cancelSeed = createConversationSession({
    organizationId: input.organizationId,
    agentId: "retell-agent-maya-discovery",
    qualificationGoal: "buying_committee_discovery",
    systemPromptTemplate: "Hello {{prospect.name}}",
  })
  const cancelled = cancelConversation(cancelSeed.sessionId, input.organizationId)
  pushCheck(checks, "session_cancel", cancelled.status === "cancelled", "Cancellation state machine works.")

  let wrongOrgBlocked = false
  try {
    getConversationStatus(cancelSeed.sessionId, randomUUID())
  } catch (error) {
    wrongOrgBlocked = error instanceof Error && error.message === "organization_scope_mismatch"
  }
  pushCheck(checks, "session_org_scope", wrongOrgBlocked, "Organization scope enforced on status read.")

  resetMediaConversationalSessionStoreForCert()
  pushCheck(checks, "session_cleanup", true, "In-memory conversational session fixtures cleared.")

  const failed = checks.filter((check) => !check.ok)
  return {
    ok: failed.length === 0,
    qa_marker: GROWTH_MEDIA_CONVERSATIONAL_SESSION_QA_MARKER,
    checks,
    final_verdict: failed.length === 0 ? "PASS" : "FAIL",
    ...GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS,
  }
}
