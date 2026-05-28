import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  VoiceAiOutboundEscalationState,
  VoiceAiOutboundEventPublicView,
  VoiceAiOutboundEventType,
  VoiceAiOutboundProviderId,
  VoiceAiOutboundSessionPublicView,
  VoiceAiOutboundSessionStatus,
  VoiceAiOutboundSupervisionMode,
  VoiceAiOutboundWorkflowType,
} from "@/lib/voice/ai-outbound/types"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"))
}

type SessionRow = {
  id: string
  organization_id: string
  related_customer_id: string | null
  related_prospect_id: string | null
  relationship_memory_profile_id: string | null
  source_recovery_event_id: string | null
  source_campaign_id: string | null
  voice_call_id: string | null
  phone_number: string
  outbound_session_status: VoiceAiOutboundSessionStatus
  outbound_workflow_type: VoiceAiOutboundWorkflowType
  ai_provider: VoiceAiOutboundProviderId
  escalation_state: VoiceAiOutboundEscalationState
  operator_supervision_mode: VoiceAiOutboundSupervisionMode
  transcript_session_id: string | null
  compliance_decision: string | null
  compliance_reasons_json: unknown
  manual_review_required: boolean
  message_preview: string | null
  approved_by: string | null
  approved_at: string | null
  started_at: string | null
  ended_at: string | null
  metadata_json: Record<string, unknown> | unknown
  created_at: string
  updated_at: string
}

type EventRow = {
  id: string
  organization_id: string
  session_id: string
  voice_call_id: string | null
  event_type: VoiceAiOutboundEventType
  evidence_text: string
  transcript_segment_id: string | null
  provider_source: VoiceAiOutboundProviderId | null
  payload_json: Record<string, unknown> | unknown
  created_by: string | null
  created_at: string
}

function mapSession(row: SessionRow): VoiceAiOutboundSessionPublicView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    relatedCustomerId: row.related_customer_id,
    relatedProspectId: row.related_prospect_id,
    relationshipMemoryProfileId: row.relationship_memory_profile_id,
    sourceRecoveryEventId: row.source_recovery_event_id,
    sourceCampaignId: row.source_campaign_id,
    voiceCallId: row.voice_call_id,
    phoneNumber: row.phone_number,
    outboundSessionStatus: row.outbound_session_status,
    outboundWorkflowType: row.outbound_workflow_type,
    aiProvider: row.ai_provider,
    escalationState: row.escalation_state,
    operatorSupervisionMode: row.operator_supervision_mode,
    transcriptSessionId: row.transcript_session_id,
    complianceDecision: row.compliance_decision,
    complianceReasons: Array.isArray(row.compliance_reasons_json)
      ? (row.compliance_reasons_json as string[])
      : [],
    manualReviewRequired: Boolean(row.manual_review_required),
    messagePreview: row.message_preview,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    metadata:
      row.metadata_json && typeof row.metadata_json === "object"
        ? (row.metadata_json as Record<string, unknown>)
        : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapEvent(row: EventRow): VoiceAiOutboundEventPublicView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sessionId: row.session_id,
    voiceCallId: row.voice_call_id,
    eventType: row.event_type,
    evidenceText: row.evidence_text,
    transcriptSegmentId: row.transcript_segment_id,
    providerSource: row.provider_source,
    payload:
      row.payload_json && typeof row.payload_json === "object"
        ? (row.payload_json as Record<string, unknown>)
        : {},
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

const ACTIVE_STATUSES: VoiceAiOutboundSessionStatus[] = [
  "queued",
  "initiating",
  "active",
  "escalation_pending",
  "operator_joined",
  "voicemail_mode",
]

export async function getOutboundSession(
  admin: SupabaseClient,
  organizationId: string,
  sessionId: string,
): Promise<VoiceAiOutboundSessionPublicView | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_outbound_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", sessionId)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return data ? mapSession(data as SessionRow) : null
}

export async function createOutboundSession(
  admin: SupabaseClient,
  input: {
    organizationId: string
    phoneNumber: string
    outboundWorkflowType: VoiceAiOutboundWorkflowType
    aiProvider: VoiceAiOutboundProviderId
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    relationshipMemoryProfileId?: string | null
    sourceRecoveryEventId?: string | null
    sourceCampaignId?: string | null
    messagePreview?: string | null
    complianceDecision?: string | null
    complianceReasons?: string[]
    manualReviewRequired?: boolean
    metadata?: Record<string, unknown>
  },
): Promise<VoiceAiOutboundSessionPublicView> {
  const normalized = normalizePhoneNumber(input.phoneNumber) || input.phoneNumber
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_outbound_sessions")
    .insert({
      organization_id: input.organizationId,
      phone_number: normalized,
      outbound_workflow_type: input.outboundWorkflowType,
      ai_provider: input.aiProvider,
      related_customer_id: input.relatedCustomerId ?? null,
      related_prospect_id: input.relatedProspectId ?? null,
      relationship_memory_profile_id: input.relationshipMemoryProfileId ?? null,
      source_recovery_event_id: input.sourceRecoveryEventId ?? null,
      source_campaign_id: input.sourceCampaignId ?? null,
      message_preview: input.messagePreview ?? null,
      compliance_decision: input.complianceDecision ?? null,
      compliance_reasons_json: input.complianceReasons ?? [],
      manual_review_required: input.manualReviewRequired ?? false,
      outbound_session_status: "pending_operator_approval",
      operator_supervision_mode: "approval_required",
      metadata_json: input.metadata ?? {},
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapSession(data as SessionRow)
}

export async function updateOutboundSession(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sessionId: string
    patch: Partial<{
      outboundSessionStatus: VoiceAiOutboundSessionStatus
      escalationState: VoiceAiOutboundEscalationState
      operatorSupervisionMode: VoiceAiOutboundSupervisionMode
      voiceCallId: string | null
      transcriptSessionId: string | null
      complianceDecision: string | null
      complianceReasons: string[]
      manualReviewRequired: boolean
      messagePreview: string | null
      approvedBy: string | null
      approvedAt: string | null
      startedAt: string | null
      endedAt: string | null
      metadata: Record<string, unknown>
    }>
  },
): Promise<VoiceAiOutboundSessionPublicView | null> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.patch.outboundSessionStatus) update.outbound_session_status = input.patch.outboundSessionStatus
  if (input.patch.escalationState) update.escalation_state = input.patch.escalationState
  if (input.patch.operatorSupervisionMode) update.operator_supervision_mode = input.patch.operatorSupervisionMode
  if (input.patch.voiceCallId !== undefined) update.voice_call_id = input.patch.voiceCallId
  if (input.patch.transcriptSessionId !== undefined) update.transcript_session_id = input.patch.transcriptSessionId
  if (input.patch.complianceDecision !== undefined) update.compliance_decision = input.patch.complianceDecision
  if (input.patch.complianceReasons) update.compliance_reasons_json = input.patch.complianceReasons
  if (input.patch.manualReviewRequired !== undefined) update.manual_review_required = input.patch.manualReviewRequired
  if (input.patch.messagePreview !== undefined) update.message_preview = input.patch.messagePreview
  if (input.patch.approvedBy !== undefined) update.approved_by = input.patch.approvedBy
  if (input.patch.approvedAt !== undefined) update.approved_at = input.patch.approvedAt
  if (input.patch.startedAt !== undefined) update.started_at = input.patch.startedAt
  if (input.patch.endedAt !== undefined) update.ended_at = input.patch.endedAt
  if (input.patch.metadata) update.metadata_json = input.patch.metadata

  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_outbound_sessions")
    .update(update)
    .eq("organization_id", input.organizationId)
    .eq("id", input.sessionId)
    .select("*")
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return data ? mapSession(data as SessionRow) : null
}

export async function appendOutboundEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sessionId: string
    eventType: VoiceAiOutboundEventType
    evidenceText: string
    voiceCallId?: string | null
    transcriptSegmentId?: string | null
    providerSource?: VoiceAiOutboundProviderId | null
    payload?: Record<string, unknown>
    createdBy?: string | null
  },
): Promise<VoiceAiOutboundEventPublicView> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_outbound_events")
    .insert({
      organization_id: input.organizationId,
      session_id: input.sessionId,
      voice_call_id: input.voiceCallId ?? null,
      event_type: input.eventType,
      evidence_text: input.evidenceText,
      transcript_segment_id: input.transcriptSegmentId ?? null,
      provider_source: input.providerSource ?? null,
      payload_json: input.payload ?? {},
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapEvent(data as EventRow)
}

export async function listOutboundEvents(
  admin: SupabaseClient,
  organizationId: string,
  sessionId: string,
  limit = 20,
): Promise<VoiceAiOutboundEventPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_outbound_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapEvent(row as EventRow))
}

export async function countActiveOutboundSessions(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_ai_outbound_sessions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("outbound_session_status", ACTIVE_STATUSES)
    .is("ended_at", null)

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(error.message)
  }
  return count ?? 0
}

export async function countPendingApprovalOutboundSessions(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_ai_outbound_sessions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("outbound_session_status", ["pending_operator_approval", "queued"])

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(error.message)
  }
  return count ?? 0
}

export async function listPendingApprovalOutboundSessions(
  admin: SupabaseClient,
  organizationId: string,
  limit = 50,
): Promise<VoiceAiOutboundSessionPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_outbound_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .in("outbound_session_status", ["pending_operator_approval", "queued"])
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapSession(row as SessionRow))
}

export async function listActiveOutboundSessions(
  admin: SupabaseClient,
  organizationId: string,
  limit = 20,
): Promise<VoiceAiOutboundSessionPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_outbound_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .in("outbound_session_status", ACTIVE_STATUSES)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapSession(row as SessionRow))
}

export async function countBlockedOutboundSessions(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_ai_outbound_sessions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("outbound_session_status", "blocked_by_compliance")

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(error.message)
  }
  return count ?? 0
}

export async function cleanupStaleOutboundSessions(
  admin: SupabaseClient,
  organizationId: string,
  staleBeforeIso: string,
): Promise<number> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_outbound_sessions")
    .update({
      outbound_session_status: "failed",
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .in("outbound_session_status", ACTIVE_STATUSES)
    .is("ended_at", null)
    .lt("started_at", staleBeforeIso)
    .select("id")

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(error.message)
  }
  return data?.length ?? 0
}
