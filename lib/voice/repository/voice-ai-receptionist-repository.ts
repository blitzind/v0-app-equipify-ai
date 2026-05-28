import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  VoiceAiReceptionistConversationPhase,
  VoiceAiReceptionistEscalationRiskLevel,
  VoiceAiReceptionistEventPublicView,
  VoiceAiReceptionistEventType,
  VoiceAiReceptionistFaqEntryPublicView,
  VoiceAiReceptionistProviderId,
  VoiceAiReceptionistQualificationFlowPublicView,
  VoiceAiReceptionistQualificationStep,
  VoiceAiReceptionistSessionPublicView,
  VoiceAiReceptionistStatus,
} from "@/lib/voice/ai-receptionist/types"

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"))
}

type SessionRow = {
  id: string
  organization_id: string
  voice_call_id: string
  voice_conference_id: string | null
  relationship_memory_profile_id: string | null
  receptionist_status: VoiceAiReceptionistStatus
  current_conversation_phase: VoiceAiReceptionistConversationPhase
  escalation_risk_level: string
  active_operator_id: string | null
  ai_provider: VoiceAiReceptionistProviderId
  transcript_session_id: string | null
  media_session_id: string | null
  qualification_state_json: Record<string, unknown> | unknown
  handoff_summary_draft: string | null
  latency_ms_last: number | null
  started_at: string
  ended_at: string | null
  metadata_json: Record<string, unknown> | unknown
}

type EventRow = {
  id: string
  organization_id: string
  session_id: string
  voice_call_id: string
  event_type: VoiceAiReceptionistEventType
  evidence_text: string
  transcript_segment_id: string | null
  provider_source: VoiceAiReceptionistProviderId | null
  payload_json: Record<string, unknown> | unknown
  created_at: string
}

function mapSession(row: SessionRow): VoiceAiReceptionistSessionPublicView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    voiceCallId: row.voice_call_id,
    voiceConferenceId: row.voice_conference_id,
    relationshipMemoryProfileId: row.relationship_memory_profile_id,
    receptionistStatus: row.receptionist_status,
    currentConversationPhase: row.current_conversation_phase,
    escalationRiskLevel: (row.escalation_risk_level as VoiceAiReceptionistEscalationRiskLevel) ?? "low",
    activeOperatorId: row.active_operator_id,
    aiProvider: row.ai_provider,
    transcriptSessionId: row.transcript_session_id,
    mediaSessionId: row.media_session_id,
    qualificationState:
      row.qualification_state_json && typeof row.qualification_state_json === "object"
        ? (row.qualification_state_json as Record<string, unknown>)
        : {},
    handoffSummaryDraft: row.handoff_summary_draft,
    latencyMsLast: row.latency_ms_last,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    metadata:
      row.metadata_json && typeof row.metadata_json === "object"
        ? (row.metadata_json as Record<string, unknown>)
        : {},
  }
}

function mapEvent(row: EventRow): VoiceAiReceptionistEventPublicView {
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
    createdAt: row.created_at,
  }
}

export async function getActiveReceptionistSessionForCall(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<VoiceAiReceptionistSessionPublicView | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_receptionist_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("voice_call_id", voiceCallId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return data ? mapSession(data as SessionRow) : null
}

export async function createReceptionistSession(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    relationshipMemoryProfileId?: string | null
    aiProvider: VoiceAiReceptionistProviderId
    transcriptSessionId?: string | null
    mediaSessionId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<VoiceAiReceptionistSessionPublicView> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_receptionist_sessions")
    .insert({
      organization_id: input.organizationId,
      voice_call_id: input.voiceCallId,
      relationship_memory_profile_id: input.relationshipMemoryProfileId ?? null,
      ai_provider: input.aiProvider,
      transcript_session_id: input.transcriptSessionId ?? null,
      media_session_id: input.mediaSessionId ?? null,
      metadata_json: input.metadata ?? {},
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapSession(data as SessionRow)
}

export async function updateReceptionistSession(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sessionId: string
    patch: Partial<{
      receptionistStatus: VoiceAiReceptionistStatus
      currentConversationPhase: VoiceAiReceptionistConversationPhase
      escalationRiskLevel: string
      activeOperatorId: string | null
      qualificationState: Record<string, unknown>
      handoffSummaryDraft: string | null
      latencyMsLast: number | null
      voiceConferenceId: string | null
      endedAt: string | null
      metadata: Record<string, unknown>
    }>
  },
): Promise<VoiceAiReceptionistSessionPublicView | null> {
  const update: Record<string, unknown> = {}
  if (input.patch.receptionistStatus) update.receptionist_status = input.patch.receptionistStatus
  if (input.patch.currentConversationPhase) update.current_conversation_phase = input.patch.currentConversationPhase
  if (input.patch.escalationRiskLevel) update.escalation_risk_level = input.patch.escalationRiskLevel
  if (input.patch.activeOperatorId !== undefined) update.active_operator_id = input.patch.activeOperatorId
  if (input.patch.qualificationState) update.qualification_state_json = input.patch.qualificationState
  if (input.patch.handoffSummaryDraft !== undefined) update.handoff_summary_draft = input.patch.handoffSummaryDraft
  if (input.patch.latencyMsLast !== undefined) update.latency_ms_last = input.patch.latencyMsLast
  if (input.patch.voiceConferenceId !== undefined) update.voice_conference_id = input.patch.voiceConferenceId
  if (input.patch.endedAt !== undefined) update.ended_at = input.patch.endedAt
  if (input.patch.metadata) update.metadata_json = input.patch.metadata

  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_receptionist_sessions")
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

export async function appendReceptionistEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sessionId: string
    voiceCallId: string
    eventType: VoiceAiReceptionistEventType
    evidenceText: string
    transcriptSegmentId?: string | null
    providerSource?: VoiceAiReceptionistProviderId | null
    payload?: Record<string, unknown>
    idempotencyKey?: string | null
  },
): Promise<VoiceAiReceptionistEventPublicView | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_receptionist_events")
    .insert({
      organization_id: input.organizationId,
      session_id: input.sessionId,
      voice_call_id: input.voiceCallId,
      event_type: input.eventType,
      evidence_text: input.evidenceText,
      transcript_segment_id: input.transcriptSegmentId ?? null,
      provider_source: input.providerSource ?? null,
      payload_json: input.payload ?? {},
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select("*")
    .single()

  if (error) {
    if (isMissingTableError(error)) return null
    if (error.code === "23505") return null
    throw new Error(error.message)
  }
  return mapEvent(data as EventRow)
}

export async function listReceptionistEvents(
  admin: SupabaseClient,
  organizationId: string,
  sessionId: string,
  limit = 40,
): Promise<VoiceAiReceptionistEventPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_receptionist_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data as EventRow[]).map(mapEvent)
}

export async function countActiveReceptionistSessions(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_ai_receptionist_sessions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("ended_at", null)

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(error.message)
  }
  return count ?? 0
}

export async function listFaqEntries(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceAiReceptionistFaqEntryPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_receptionist_faq_entries")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    organizationId: row.organization_id as string,
    topic: row.topic as string,
    questionPattern: row.question_pattern as string,
    approvedAnswer: row.approved_answer as string,
    escalationRequired: Boolean(row.escalation_required),
    blocked: Boolean(row.blocked),
    sortOrder: Number(row.sort_order ?? 0),
  }))
}

export async function getQualificationFlow(
  admin: SupabaseClient,
  organizationId: string,
  flowKey = "inbound_default",
): Promise<VoiceAiReceptionistQualificationFlowPublicView | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_receptionist_qualification_flows")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("flow_key", flowKey)
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  if (!data) return null

  const steps = Array.isArray(data.steps_json) ? (data.steps_json as VoiceAiReceptionistQualificationStep[]) : []
  const triggers = Array.isArray(data.escalation_triggers_json)
    ? (data.escalation_triggers_json as string[])
    : []

  return {
    id: data.id as string,
    organizationId: data.organization_id as string,
    flowKey: data.flow_key as string,
    label: data.label as string,
    steps,
    escalationTriggers: triggers,
    isActive: Boolean(data.is_active),
  }
}

export async function ensureDefaultReceptionistConfig(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const faqs = await listFaqEntries(admin, organizationId)
  if (faqs.length === 0) {
    const { buildDefaultFaqEntries } = await import("@/lib/voice/ai-receptionist/faq-orchestrator")
    for (const entry of buildDefaultFaqEntries(organizationId)) {
      await admin.schema("voice").from("voice_ai_receptionist_faq_entries").insert({
        organization_id: organizationId,
        topic: entry.topic,
        question_pattern: entry.questionPattern,
        approved_answer: entry.approvedAnswer,
        escalation_required: entry.escalationRequired,
        blocked: entry.blocked,
        sort_order: entry.sortOrder,
      })
    }
  }

  const flow = await getQualificationFlow(admin, organizationId)
  if (!flow) {
    const { buildDefaultQualificationFlow } = await import("@/lib/voice/ai-receptionist/qualification-flows")
    const def = buildDefaultQualificationFlow(organizationId)
    await admin.schema("voice").from("voice_ai_receptionist_qualification_flows").insert({
      organization_id: organizationId,
      flow_key: def.flowKey,
      label: def.label,
      steps_json: def.steps,
      escalation_triggers_json: def.escalationTriggers,
      is_active: true,
    })
  }
}
