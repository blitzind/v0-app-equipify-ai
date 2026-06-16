import "server-only"

import { randomUUID } from "node:crypto"
import { extractContentMergeFields } from "@/lib/growth/content/merge-field-validator"
import { validateConversationalAgentId } from "@/lib/growth/media/media-conversational-agent-types"
import { validateConversationalQualificationGoal } from "@/lib/growth/media/media-conversational-qualification-types"
import {
  buildConversationPreview,
  buildQualificationPreview,
  evaluateQualificationState,
} from "@/lib/growth/media/media-conversational-session-utils"
import {
  mapRetellVideoAgentProviderStatusToSessionStatus,
} from "@/lib/growth/media/providers/retell-video-agent-provider"
import type { RetellVideoAgentProviderStatus } from "@/lib/growth/media/providers/retell-video-agent-provider-types"
import {
  GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS,
  type GrowthMediaConversationalSessionCreateInput,
  type GrowthMediaConversationalSessionRecord,
  type GrowthMediaConversationalSessionStatus,
} from "@/lib/growth/media/media-conversational-session-types"

export {
  buildConversationPreview,
  buildQualificationPreview,
  evaluateQualificationState,
} from "@/lib/growth/media/media-conversational-session-utils"

const sessionStore = new Map<string, GrowthMediaConversationalSessionRecord>()

function nowIso(): string {
  return new Date().toISOString()
}

export function resetMediaConversationalSessionStoreForCert(): void {
  sessionStore.clear()
}

export function mapProviderStatus(
  providerStatus: RetellVideoAgentProviderStatus,
): GrowthMediaConversationalSessionStatus {
  return mapRetellVideoAgentProviderStatusToSessionStatus(providerStatus)
}

function buildInitialQualification(input: GrowthMediaConversationalSessionCreateInput) {
  return evaluateQualificationState({
    qualificationGoal: input.qualificationGoal ?? input.conversationContext?.qualificationGoal ?? null,
    conversationContext: input.conversationContext ?? {},
  })
}

export function createConversationSession(
  input: GrowthMediaConversationalSessionCreateInput,
): GrowthMediaConversationalSessionRecord {
  if (!input.organizationId.trim()) throw new Error("organization_id_required")
  if (input.agentId && !validateConversationalAgentId(input.agentId)) throw new Error("invalid_agent_id")
  if (
    input.qualificationGoal &&
    !validateConversationalQualificationGoal(input.qualificationGoal)
  ) {
    throw new Error("invalid_qualification_goal")
  }

  const systemPromptTemplate =
    input.systemPromptTemplate?.trim() ||
    input.conversationContext?.systemPromptTemplate?.trim() ||
    ""
  if (!systemPromptTemplate) throw new Error("system_prompt_template_required")

  const conversationContext = {
    ...(input.conversationContext ?? {}),
    qualificationGoal: input.qualificationGoal ?? input.conversationContext?.qualificationGoal ?? null,
    systemPromptTemplate,
  }
  const { qualificationState, meetingRecommendation } = buildInitialQualification({
    ...input,
    conversationContext,
  })
  const timestamp = nowIso()

  const record: GrowthMediaConversationalSessionRecord = {
    sessionId: randomUUID(),
    organizationId: input.organizationId,
    agentId: input.agentId ?? null,
    provider: "retell",
    status: "draft",
    leadId: input.leadId ?? null,
    sharePageId: input.sharePageId ?? null,
    templateId: input.templateId ?? null,
    conversationContext,
    qualificationState,
    meetingRecommendation,
    transcript: null,
    summary: null,
    providerSessionId: null,
    error: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  sessionStore.set(record.sessionId, record)
  return record
}

export function startConversation(sessionId: string, organizationId: string): GrowthMediaConversationalSessionRecord {
  const record = getConversationStatus(sessionId, organizationId)
  if (record.status !== "draft" && record.status !== "ready") throw new Error("invalid_status_transition")
  if (!record.agentId || !validateConversationalAgentId(record.agentId)) throw new Error("agent_id_required")

  const updated: GrowthMediaConversationalSessionRecord = {
    ...record,
    status: "ready",
    updatedAt: nowIso(),
  }
  sessionStore.set(updated.sessionId, updated)
  return updated
}

export function endConversation(sessionId: string, organizationId: string): GrowthMediaConversationalSessionRecord {
  const record = getConversationStatus(sessionId, organizationId)
  if (record.status !== "ready" && record.status !== "active") throw new Error("invalid_status_transition")

  const updated: GrowthMediaConversationalSessionRecord = {
    ...record,
    status: "completed",
    transcript: null,
    summary: null,
    updatedAt: nowIso(),
  }
  sessionStore.set(updated.sessionId, updated)
  return updated
}

export function cancelConversation(
  sessionId: string,
  organizationId: string,
): GrowthMediaConversationalSessionRecord {
  const record = getConversationStatus(sessionId, organizationId)
  if (record.status === "completed" || record.status === "failed" || record.status === "cancelled") {
    throw new Error("invalid_status_transition")
  }

  const updated: GrowthMediaConversationalSessionRecord = {
    ...record,
    status: "cancelled",
    updatedAt: nowIso(),
  }
  sessionStore.set(updated.sessionId, updated)
  return updated
}

export function getConversationStatus(
  sessionId: string,
  organizationId: string,
): GrowthMediaConversationalSessionRecord {
  const record = getSessionRecordOrThrow(sessionId)
  if (record.organizationId !== organizationId) throw new Error("organization_scope_mismatch")
  return record
}

function getSessionRecordOrThrow(sessionId: string): GrowthMediaConversationalSessionRecord {
  const record = sessionStore.get(sessionId)
  if (!record) throw new Error("conversation_not_found")
  return record
}

export function toGrowthMediaConversationalSessionResponse(record: GrowthMediaConversationalSessionRecord) {
  const promptPreview = buildConversationPreview({
    agentId: record.agentId,
    systemPromptTemplate: record.conversationContext.systemPromptTemplate,
    conversationContext: record.conversationContext,
  })
  const qualificationPreview = buildQualificationPreview({
    qualificationGoal: record.qualificationState.goal ?? record.conversationContext.qualificationGoal,
  })
  const mergeFieldsUsed = extractContentMergeFields(record.conversationContext.systemPromptTemplate ?? "")

  return {
    ok: true as const,
    session: record,
    prompt_preview: promptPreview,
    qualification_preview: qualificationPreview,
    merge_fields_used: mergeFieldsUsed,
    ...GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS,
  }
}
