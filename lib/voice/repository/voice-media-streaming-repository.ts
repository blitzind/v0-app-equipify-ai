import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  VoiceMediaParticipantRecord,
  VoiceMediaSessionRecord,
  VoiceMediaTimelineEventRecord,
  VoiceMediaTimelineEventType,
  VoiceStreamStatus,
  VoiceTranscriptSegmentPublicView,
  VoiceTranscriptSegmentRecord,
  VoiceTranscriptSessionRecord,
} from "@/lib/voice/media-streaming/types"

function mapMediaSession(row: Record<string, unknown>): VoiceMediaSessionRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    voiceCallId: String(row.voice_call_id),
    voiceConferenceId: row.voice_conference_id ? String(row.voice_conference_id) : null,
    voiceRecordingId: row.voice_recording_id ? String(row.voice_recording_id) : null,
    provider: String(row.provider),
    providerStreamSid: String(row.provider_stream_sid ?? ""),
    mediaDirection: row.media_direction as VoiceMediaSessionRecord["mediaDirection"],
    streamStatus: row.stream_status as VoiceMediaSessionRecord["streamStatus"],
    startedAt: row.started_at ? String(row.started_at) : null,
    endedAt: row.ended_at ? String(row.ended_at) : null,
    reconnectCount: Number(row.reconnect_count ?? 0),
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapMediaParticipant(row: Record<string, unknown>): VoiceMediaParticipantRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    mediaSessionId: String(row.media_session_id),
    voiceCallLegId: row.voice_call_leg_id ? String(row.voice_call_leg_id) : null,
    participantType: row.participant_type as VoiceMediaParticipantRecord["participantType"],
    audioTrack: row.audio_track as VoiceMediaParticipantRecord["audioTrack"],
    streamIdentity: String(row.stream_identity ?? ""),
    isActive: Boolean(row.is_active),
    joinedAt: row.joined_at ? String(row.joined_at) : null,
    leftAt: row.left_at ? String(row.left_at) : null,
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }
}

function mapTranscriptSession(row: Record<string, unknown>): VoiceTranscriptSessionRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    mediaSessionId: String(row.media_session_id),
    voiceRecordingId: row.voice_recording_id ? String(row.voice_recording_id) : null,
    transcriptProvider: row.transcript_provider as VoiceTranscriptSessionRecord["transcriptProvider"],
    transcriptStatus: row.transcript_status as VoiceTranscriptSessionRecord["transcriptStatus"],
    startedAt: row.started_at ? String(row.started_at) : null,
    endedAt: row.ended_at ? String(row.ended_at) : null,
    avgLatencyMs: row.avg_latency_ms == null ? null : Number(row.avg_latency_ms),
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }
}

function mapTranscriptSegment(row: Record<string, unknown>): VoiceTranscriptSegmentRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    transcriptSessionId: String(row.transcript_session_id),
    voiceCallLegId: row.voice_call_leg_id ? String(row.voice_call_leg_id) : null,
    speakerIdentity: String(row.speaker_identity ?? ""),
    speakerType: row.speaker_type as VoiceTranscriptSegmentRecord["speakerType"],
    transcriptText: String(row.transcript_text ?? ""),
    confidenceScore: row.confidence_score == null ? null : Number(row.confidence_score),
    startedAt: row.started_at ? String(row.started_at) : null,
    endedAt: row.ended_at ? String(row.ended_at) : null,
    sequenceNumber: Number(row.sequence_number),
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }
}

function mapTimelineEvent(row: Record<string, unknown>): VoiceMediaTimelineEventRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    mediaSessionId: String(row.media_session_id),
    voiceCallId: String(row.voice_call_id),
    eventType: row.event_type as VoiceMediaTimelineEventType,
    eventTimestamp: String(row.event_timestamp),
    idempotencyKey: String(row.idempotency_key),
    payloadJson: (row.payload_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }
}

const SPEAKER_LABELS: Record<VoiceTranscriptSegmentRecord["speakerType"], string> = {
  operator: "Operator",
  customer: "Customer",
  supervisor: "Supervisor",
  system: "System",
  unknown: "Unknown",
}

export function toTranscriptSegmentPublicView(segment: VoiceTranscriptSegmentRecord): VoiceTranscriptSegmentPublicView {
  return {
    id: segment.id,
    speakerIdentity: segment.speakerIdentity,
    speakerType: segment.speakerType,
    speakerLabel: SPEAKER_LABELS[segment.speakerType] ?? (segment.speakerIdentity || "Unknown"),
    transcriptText: segment.transcriptText,
    confidenceScore: segment.confidenceScore,
    startedAt: segment.startedAt,
    endedAt: segment.endedAt,
    sequenceNumber: segment.sequenceNumber,
  }
}

export async function findActiveMediaSessionByProviderStream(
  admin: SupabaseClient,
  input: { organizationId: string; provider: string; providerStreamSid: string },
): Promise<VoiceMediaSessionRecord | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_media_sessions")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("provider", input.provider)
    .eq("provider_stream_sid", input.providerStreamSid)
    .in("stream_status", ["connecting", "active", "reconnecting"])
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapMediaSession(data as Record<string, unknown>) : null
}

export async function findMediaSessionById(
  admin: SupabaseClient,
  organizationId: string,
  mediaSessionId: string,
): Promise<VoiceMediaSessionRecord | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_media_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", mediaSessionId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapMediaSession(data as Record<string, unknown>) : null
}

export async function findActiveMediaSessionForCall(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<VoiceMediaSessionRecord | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_media_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("voice_call_id", voiceCallId)
    .in("stream_status", ["connecting", "active", "reconnecting"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapMediaSession(data as Record<string, unknown>) : null
}

export async function insertMediaSession(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    voiceConferenceId?: string | null
    voiceRecordingId?: string | null
    provider: string
    providerStreamSid: string
    mediaDirection?: VoiceMediaSessionRecord["mediaDirection"]
    metadataJson?: Record<string, unknown>
  },
): Promise<VoiceMediaSessionRecord> {
  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("voice")
    .from("voice_media_sessions")
    .insert({
      organization_id: input.organizationId,
      voice_call_id: input.voiceCallId,
      voice_conference_id: input.voiceConferenceId ?? null,
      voice_recording_id: input.voiceRecordingId ?? null,
      provider: input.provider,
      provider_stream_sid: input.providerStreamSid,
      media_direction: input.mediaDirection ?? "duplex",
      stream_status: "connecting",
      started_at: now,
      metadata_json: input.metadataJson ?? {},
      updated_at: now,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapMediaSession(data as Record<string, unknown>)
}

export async function updateMediaSessionStatus(
  admin: SupabaseClient,
  input: {
    organizationId: string
    mediaSessionId: string
    streamStatus: VoiceStreamStatus
    reconnectCount?: number
    endedAt?: string | null
    metadataPatch?: Record<string, unknown>
  },
): Promise<VoiceMediaSessionRecord> {
  const patch: Record<string, unknown> = {
    stream_status: input.streamStatus,
    updated_at: new Date().toISOString(),
  }
  if (input.reconnectCount != null) patch.reconnect_count = input.reconnectCount
  if (input.endedAt !== undefined) patch.ended_at = input.endedAt
  if (input.metadataPatch) patch.metadata_json = input.metadataPatch

  const { data, error } = await admin
    .schema("voice")
    .from("voice_media_sessions")
    .update(patch)
    .eq("organization_id", input.organizationId)
    .eq("id", input.mediaSessionId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapMediaSession(data as Record<string, unknown>)
}

export async function insertMediaParticipant(
  admin: SupabaseClient,
  input: {
    organizationId: string
    mediaSessionId: string
    voiceCallLegId?: string | null
    participantType?: VoiceMediaParticipantRecord["participantType"]
    audioTrack?: VoiceMediaParticipantRecord["audioTrack"]
    streamIdentity?: string
    metadataJson?: Record<string, unknown>
  },
): Promise<VoiceMediaParticipantRecord> {
  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("voice")
    .from("voice_media_participants")
    .insert({
      organization_id: input.organizationId,
      media_session_id: input.mediaSessionId,
      voice_call_leg_id: input.voiceCallLegId ?? null,
      participant_type: input.participantType ?? "unknown",
      audio_track: input.audioTrack ?? "mixed",
      stream_identity: input.streamIdentity ?? "",
      is_active: true,
      joined_at: now,
      metadata_json: input.metadataJson ?? {},
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapMediaParticipant(data as Record<string, unknown>)
}

export async function deactivateMediaParticipant(
  admin: SupabaseClient,
  input: { organizationId: string; participantId: string },
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await admin
    .schema("voice")
    .from("voice_media_participants")
    .update({ is_active: false, left_at: now })
    .eq("organization_id", input.organizationId)
    .eq("id", input.participantId)
  if (error) throw new Error(error.message)
}

export async function listActiveMediaParticipants(
  admin: SupabaseClient,
  organizationId: string,
  mediaSessionId: string,
): Promise<VoiceMediaParticipantRecord[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_media_participants")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("media_session_id", mediaSessionId)
    .eq("is_active", true)
    .order("joined_at", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapMediaParticipant(row as Record<string, unknown>))
}

export async function insertTranscriptSession(
  admin: SupabaseClient,
  input: {
    organizationId: string
    mediaSessionId: string
    voiceRecordingId?: string | null
    transcriptProvider?: VoiceTranscriptSessionRecord["transcriptProvider"]
    metadataJson?: Record<string, unknown>
  },
): Promise<VoiceTranscriptSessionRecord> {
  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("voice")
    .from("voice_transcript_sessions")
    .insert({
      organization_id: input.organizationId,
      media_session_id: input.mediaSessionId,
      voice_recording_id: input.voiceRecordingId ?? null,
      transcript_provider: input.transcriptProvider ?? "stub",
      transcript_status: "starting",
      started_at: now,
      metadata_json: input.metadataJson ?? {},
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapTranscriptSession(data as Record<string, unknown>)
}

export async function findActiveTranscriptSessionForMedia(
  admin: SupabaseClient,
  organizationId: string,
  mediaSessionId: string,
): Promise<VoiceTranscriptSessionRecord | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_transcript_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("media_session_id", mediaSessionId)
    .in("transcript_status", ["starting", "active", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapTranscriptSession(data as Record<string, unknown>) : null
}

export async function updateTranscriptSessionStatus(
  admin: SupabaseClient,
  input: {
    organizationId: string
    transcriptSessionId: string
    transcriptStatus: VoiceTranscriptSessionRecord["transcriptStatus"]
    avgLatencyMs?: number | null
    endedAt?: string | null
  },
): Promise<void> {
  const patch: Record<string, unknown> = { transcript_status: input.transcriptStatus }
  if (input.avgLatencyMs !== undefined) patch.avg_latency_ms = input.avgLatencyMs
  if (input.endedAt !== undefined) patch.ended_at = input.endedAt
  const { error } = await admin
    .schema("voice")
    .from("voice_transcript_sessions")
    .update(patch)
    .eq("organization_id", input.organizationId)
    .eq("id", input.transcriptSessionId)
  if (error) throw new Error(error.message)
}

export async function getNextTranscriptSequenceNumber(
  admin: SupabaseClient,
  transcriptSessionId: string,
): Promise<number> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_transcript_segments")
    .select("sequence_number")
    .eq("transcript_session_id", transcriptSessionId)
    .order("sequence_number", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.sequence_number != null ? Number(data.sequence_number) + 1 : 0
}

export async function appendTranscriptSegment(
  admin: SupabaseClient,
  input: {
    organizationId: string
    transcriptSessionId: string
    voiceCallLegId?: string | null
    speakerIdentity: string
    speakerType: VoiceTranscriptSegmentRecord["speakerType"]
    transcriptText: string
    confidenceScore?: number | null
    startedAt?: string | null
    endedAt?: string | null
    sequenceNumber: number
    metadataJson?: Record<string, unknown>
  },
): Promise<VoiceTranscriptSegmentRecord> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_transcript_segments")
    .insert({
      organization_id: input.organizationId,
      transcript_session_id: input.transcriptSessionId,
      voice_call_leg_id: input.voiceCallLegId ?? null,
      speaker_identity: input.speakerIdentity,
      speaker_type: input.speakerType,
      transcript_text: input.transcriptText,
      confidence_score: input.confidenceScore ?? null,
      started_at: input.startedAt ?? null,
      ended_at: input.endedAt ?? null,
      sequence_number: input.sequenceNumber,
      metadata_json: input.metadataJson ?? {},
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapTranscriptSegment(data as Record<string, unknown>)
}

export async function listTranscriptSegments(
  admin: SupabaseClient,
  input: {
    organizationId: string
    transcriptSessionId: string
    afterSequenceNumber?: number | null
    limit?: number
  },
): Promise<VoiceTranscriptSegmentRecord[]> {
  let query = admin
    .schema("voice")
    .from("voice_transcript_segments")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("transcript_session_id", input.transcriptSessionId)
    .order("sequence_number", { ascending: true })
    .limit(input.limit ?? 200)

  if (input.afterSequenceNumber != null) {
    query = query.gt("sequence_number", input.afterSequenceNumber)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapTranscriptSegment(row as Record<string, unknown>))
}

export async function appendMediaTimelineEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    mediaSessionId: string
    voiceCallId: string
    eventType: VoiceMediaTimelineEventType
    eventTimestamp?: string
    idempotencyKey: string
    payloadJson?: Record<string, unknown>
  },
): Promise<VoiceMediaTimelineEventRecord | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_media_timeline_events")
    .insert({
      organization_id: input.organizationId,
      media_session_id: input.mediaSessionId,
      voice_call_id: input.voiceCallId,
      event_type: input.eventType,
      event_timestamp: input.eventTimestamp ?? new Date().toISOString(),
      idempotency_key: input.idempotencyKey,
      payload_json: input.payloadJson ?? {},
    })
    .select("*")
    .maybeSingle()

  if (error) {
    if (error.code === "23505") return null
    throw new Error(error.message)
  }
  return data ? mapTimelineEvent(data as Record<string, unknown>) : null
}

export async function countActiveMediaSessions(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_media_sessions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("stream_status", ["connecting", "active", "reconnecting"])
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function countActiveTranscriptSessions(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_transcript_sessions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("transcript_status", ["starting", "active", "paused"])
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function findLatestRecordingForCall(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_recordings")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("voice_call_id", voiceCallId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.id ? { id: String(data.id) } : null
}

export async function cleanupStaleMediaSessions(
  admin: SupabaseClient,
  input: { organizationId: string; staleBeforeIso: string },
): Promise<number> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_media_sessions")
    .update({
      stream_status: "failed",
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata_json: { cleanupReason: "stale_stream_timeout" },
    })
    .eq("organization_id", input.organizationId)
    .in("stream_status", ["connecting", "reconnecting"])
    .lt("updated_at", input.staleBeforeIso)
    .select("id")
  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

export async function findVoiceCallByProviderCallSid(
  admin: SupabaseClient,
  input: { organizationId: string; provider: string; providerCallSid: string },
): Promise<{ id: string; voiceConferenceId: string | null } | null> {
  const { data: leg, error: legError } = await admin
    .schema("voice")
    .from("voice_call_legs")
    .select("voice_call_id")
    .eq("organization_id", input.organizationId)
    .eq("provider", input.provider)
    .eq("provider_call_sid", input.providerCallSid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (legError) throw new Error(legError.message)

  let voiceCallId = leg?.voice_call_id ? String(leg.voice_call_id) : null
  if (!voiceCallId) {
    const { data: callRow, error: callError } = await admin
      .schema("voice")
      .from("voice_calls")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("provider", input.provider)
      .eq("provider_call_id", input.providerCallSid)
      .maybeSingle()
    if (callError) throw new Error(callError.message)
    voiceCallId = callRow?.id ? String(callRow.id) : null
  }
  if (!voiceCallId) return null

  const { data: conference, error: confError } = await admin
    .schema("voice")
    .from("voice_conferences")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("voice_call_id", voiceCallId)
    .in("status", ["initiated", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (confError) throw new Error(confError.message)

  return {
    id: voiceCallId,
    voiceConferenceId: conference?.id ? String(conference.id) : null,
  }
}
