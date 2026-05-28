import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  VoiceConversationMemoryDraftPublicView,
  VoiceIntelligenceAnalysisProvider,
  VoiceIntelligenceEventPublicView,
  VoiceIntelligenceEventStatus,
  VoiceIntelligenceInsightDraft,
  VoiceMemoryDraftStatus,
} from "@/lib/voice/intelligence/types"

function mapEvent(row: Record<string, unknown>): VoiceIntelligenceEventPublicView {
  return {
    id: row.id as string,
    eventType: row.event_type as string,
    confidenceScore: Number(row.confidence_score),
    evidenceText: row.evidence_text as string,
    suggestedOperatorAction: (row.suggested_operator_action as string) ?? "",
    analysisProvider: row.analysis_provider as VoiceIntelligenceAnalysisProvider,
    status: row.status as VoiceIntelligenceEventStatus,
    transcriptSegmentId: row.transcript_segment_id as string,
    sequenceNumber:
      typeof row.sequence_number === "number"
        ? row.sequence_number
        : row.sequence_number != null
          ? Number(row.sequence_number)
          : null,
    createdAt: row.created_at as string,
  }
}

function mapMemoryDraft(row: Record<string, unknown>): VoiceConversationMemoryDraftPublicView {
  return {
    id: row.id as string,
    draftKind: row.draft_kind as string,
    draftLabel: row.draft_label as string,
    draftValue: row.draft_value as string,
    evidenceText: row.evidence_text as string,
    confidenceScore: Number(row.confidence_score),
    status: row.status as VoiceMemoryDraftStatus,
    createdAt: row.created_at as string,
  }
}

async function insertSpecializedEvent(
  admin: SupabaseClient,
  table:
    | "voice_conversation_intelligence_events"
    | "voice_objection_events"
    | "voice_buying_signal_events"
    | "voice_risk_events"
    | "voice_operator_guidance_events",
  input: {
    organizationId: string
    voiceCallId: string
    transcriptSessionId: string
    transcriptSegmentId: string
    eventType: string
    confidenceScore: number
    evidenceText: string
    suggestedOperatorAction: string
    analysisProvider: VoiceIntelligenceAnalysisProvider
    metadataJson?: Record<string, unknown>
  },
): Promise<VoiceIntelligenceEventPublicView | null> {
  const { data, error } = await admin
    .schema("voice")
    .from(table)
    .insert({
      organization_id: input.organizationId,
      voice_call_id: input.voiceCallId,
      transcript_session_id: input.transcriptSessionId,
      transcript_segment_id: input.transcriptSegmentId,
      event_type: input.eventType,
      confidence_score: input.confidenceScore,
      evidence_text: input.evidenceText,
      suggested_operator_action: input.suggestedOperatorAction,
      analysis_provider: input.analysisProvider,
      metadata_json: input.metadataJson ?? {},
    })
    .select("*")
    .maybeSingle()

  if (error) {
    if (error.code === "23505") return null
    throw new Error(error.message)
  }
  if (!data) return null
  return mapEvent(data as Record<string, unknown>)
}

export async function persistVoiceIntelligenceInsight(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    transcriptSessionId: string
    transcriptSegmentId: string
    sequenceNumber: number
    analysisProvider: VoiceIntelligenceAnalysisProvider
    insight: VoiceIntelligenceInsightDraft
  },
): Promise<{ conversationEventId: string | null; created: boolean }> {
  const tableByCategory = {
    conversation: "voice_conversation_intelligence_events",
    objection: "voice_objection_events",
    buying_signal: "voice_buying_signal_events",
    risk: "voice_risk_events",
    guidance: "voice_operator_guidance_events",
  } as const

  const table = tableByCategory[input.insight.category]
  const event = await insertSpecializedEvent(admin, table, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    transcriptSessionId: input.transcriptSessionId,
    transcriptSegmentId: input.transcriptSegmentId,
    eventType: input.insight.eventType,
    confidenceScore: input.insight.confidenceScore,
    evidenceText: input.insight.evidenceText,
    suggestedOperatorAction: input.insight.suggestedOperatorAction,
    analysisProvider: input.analysisProvider,
    metadataJson: { sequenceNumber: input.sequenceNumber },
  })

  let conversationEventId: string | null = null
  if (input.insight.category !== "conversation") {
    const conversationEvent = await insertSpecializedEvent(admin, "voice_conversation_intelligence_events", {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
      transcriptSessionId: input.transcriptSessionId,
      transcriptSegmentId: input.transcriptSegmentId,
      eventType: `${input.insight.eventType}_signal`,
      confidenceScore: input.insight.confidenceScore,
      evidenceText: input.insight.evidenceText,
      suggestedOperatorAction: input.insight.suggestedOperatorAction,
      analysisProvider: input.analysisProvider,
      metadataJson: { sequenceNumber: input.sequenceNumber, sourceCategory: input.insight.category },
    })
    conversationEventId = conversationEvent?.id ?? null
  } else {
    conversationEventId = event?.id ?? null
  }

  if (input.insight.memoryDraft) {
    await admin.schema("voice").from("voice_conversation_memory_drafts").insert({
      organization_id: input.organizationId,
      voice_call_id: input.voiceCallId,
      transcript_session_id: input.transcriptSessionId,
      transcript_segment_id: input.transcriptSegmentId,
      intelligence_event_id: conversationEventId,
      draft_kind: input.insight.memoryDraft.draftKind,
      draft_label: input.insight.memoryDraft.draftLabel,
      draft_value: input.insight.memoryDraft.draftValue,
      evidence_text: input.insight.evidenceText,
      confidence_score: input.insight.confidenceScore,
      analysis_provider: input.analysisProvider,
      status: "pending_review",
      metadata_json: { sequenceNumber: input.sequenceNumber },
    })
  }

  return { conversationEventId, created: Boolean(event) }
}

async function listEventsForCall(
  admin: SupabaseClient,
  table:
    | "voice_conversation_intelligence_events"
    | "voice_objection_events"
    | "voice_buying_signal_events"
    | "voice_risk_events"
    | "voice_operator_guidance_events",
  organizationId: string,
  voiceCallId: string,
): Promise<VoiceIntelligenceEventPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from(table)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("voice_call_id", voiceCallId)
    .order("created_at", { ascending: true })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    mapEvent({
      ...(row as Record<string, unknown>),
      sequence_number:
        ((row as Record<string, unknown>).metadata_json as Record<string, unknown> | undefined)?.sequenceNumber ?? null,
    }),
  )
}

export async function listVoiceConversationIntelligenceForCall(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<{
  liveSignals: VoiceIntelligenceEventPublicView[]
  objections: VoiceIntelligenceEventPublicView[]
  buyingSignals: VoiceIntelligenceEventPublicView[]
  riskEvents: VoiceIntelligenceEventPublicView[]
  operatorGuidance: VoiceIntelligenceEventPublicView[]
  memoryDrafts: VoiceConversationMemoryDraftPublicView[]
}> {
  const [liveSignals, objections, buyingSignals, riskEvents, operatorGuidance, memoryDraftRows] = await Promise.all([
    listEventsForCall(admin, "voice_conversation_intelligence_events", organizationId, voiceCallId),
    listEventsForCall(admin, "voice_objection_events", organizationId, voiceCallId),
    listEventsForCall(admin, "voice_buying_signal_events", organizationId, voiceCallId),
    listEventsForCall(admin, "voice_risk_events", organizationId, voiceCallId),
    listEventsForCall(admin, "voice_operator_guidance_events", organizationId, voiceCallId),
    admin
      .schema("voice")
      .from("voice_conversation_memory_drafts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("voice_call_id", voiceCallId)
      .order("created_at", { ascending: true })
      .limit(50),
  ])

  if (memoryDraftRows.error) throw new Error(memoryDraftRows.error.message)

  return {
    liveSignals,
    objections,
    buyingSignals,
    riskEvents,
    operatorGuidance,
    memoryDrafts: (memoryDraftRows.data ?? []).map((row) => mapMemoryDraft(row as Record<string, unknown>)),
  }
}
