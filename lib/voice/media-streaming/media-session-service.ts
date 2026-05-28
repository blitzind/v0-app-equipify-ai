import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { emitDeterministicMediaEvent } from "@/lib/voice/media-streaming/media-event-engine"
import type {
  VoiceCallTranscriptSnapshot,
  VoiceMediaCorrelationSnapshot,
  VoiceMediaParticipantType,
  VoiceSpeakerType,
} from "@/lib/voice/media-streaming/types"
import { VOICE_MEDIA_STREAMING_QA_MARKER } from "@/lib/voice/media-streaming/types"
import {
  acquireVoiceMediaStreamOwnership,
  cleanupStaleVoiceMediaStreamOwnership,
  getVoiceMediaStreamOwnershipMetrics,
  releaseVoiceMediaStreamOwnership,
  touchVoiceMediaStreamOwnership,
} from "@/lib/voice/media-streaming/stream-session-registry"
import {
  appendTranscriptSegment,
  countActiveMediaSessions,
  countActiveTranscriptSessions,
  cleanupStaleMediaSessions,
  deactivateMediaParticipant,
  findActiveMediaSessionByProviderStream,
  findActiveMediaSessionForCall,
  findActiveTranscriptSessionForMedia,
  findLatestRecordingForCall,
  findMediaSessionById,
  findVoiceCallByProviderCallSid,
  getNextTranscriptSequenceNumber,
  insertMediaParticipant,
  insertMediaSession,
  insertTranscriptSession,
  listActiveMediaParticipants,
  listTranscriptSegments,
  toTranscriptSegmentPublicView,
  updateMediaSessionStatus,
  updateTranscriptSessionStatus,
} from "@/lib/voice/repository/voice-media-streaming-repository"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import { processTranscriptSegmentIntelligence } from "@/lib/voice/intelligence/intelligence-service"
import { createVoiceTranscriptProvider } from "@/lib/voice/transcripts/providers/registry"
import { resolveConfiguredTranscriptProviderKind } from "@/lib/voice/transcripts/providers/types"
import {
  parseTwilioMediaStreamMessage,
  type TwilioMediaStreamFrame,
} from "@/lib/voice/media-streaming/twilio-media-parser"
import type { VoiceProviderId } from "@/lib/voice/types"

export { parseTwilioMediaStreamMessage, type TwilioMediaStreamFrame } from "@/lib/voice/media-streaming/twilio-media-parser"

const STALE_STREAM_MS = 5 * 60 * 1000

function mapTwilioTrackToParticipantType(track?: string): VoiceMediaParticipantType {
  if (track === "inbound") return "customer"
  if (track === "outbound") return "operator"
  return "unknown"
}

function mapTwilioTrackToSpeakerType(track?: string): VoiceSpeakerType {
  if (track === "inbound") return "customer"
  if (track === "outbound") return "operator"
  return "unknown"
}

export async function resolveOrganizationForTwilioMediaStream(
  admin: SupabaseClient,
  input: { accountSid?: string; callSid: string },
): Promise<{ organizationId: string; voiceCallId: string; voiceConferenceId: string | null } | null> {
  const orgFromEnv = process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()
  if (!orgFromEnv) return null

  const callMatch = await findVoiceCallByProviderCallSid(admin, {
    organizationId: orgFromEnv,
    provider: "twilio",
    providerCallSid: input.callSid,
  })
  if (!callMatch) return null
  return { organizationId: orgFromEnv, voiceCallId: callMatch.id, voiceConferenceId: callMatch.voiceConferenceId }
}

export async function startVoiceMediaStreamSession(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    voiceConferenceId?: string | null
    provider: VoiceProviderId
    providerStreamSid: string
    connectionId: string
    customParameters?: Record<string, string>
  },
): Promise<{ ok: boolean; mediaSessionId: string; transcriptSessionId: string | null; duplicate: boolean; message: string }> {
  const existing = await findActiveMediaSessionByProviderStream(admin, {
    organizationId: input.organizationId,
    provider: input.provider,
    providerStreamSid: input.providerStreamSid,
  })
  if (existing) {
    const ownership = acquireVoiceMediaStreamOwnership({
      connectionId: input.connectionId,
      organizationId: input.organizationId,
      mediaSessionId: existing.id,
      providerStreamSid: input.providerStreamSid,
      allowReconnect: true,
    })
    if (!ownership.ok) {
      return { ok: false, mediaSessionId: existing.id, transcriptSessionId: null, duplicate: true, message: ownership.reason }
    }
    if (ownership.duplicate && ownership.reason === "reconnect") {
      await updateMediaSessionStatus(admin, {
        organizationId: input.organizationId,
        mediaSessionId: existing.id,
        streamStatus: "reconnecting",
        reconnectCount: ownership.record.reconnectCount,
      })
      await emitDeterministicMediaEvent(admin, {
        organizationId: input.organizationId,
        mediaSessionId: existing.id,
        voiceCallId: input.voiceCallId,
        provider: input.provider,
        eventType: "stream_reconnect",
        idempotencySuffix: `${input.connectionId}:${ownership.record.reconnectCount}`,
        payload: { providerStreamSid: input.providerStreamSid },
      })
      await updateMediaSessionStatus(admin, {
        organizationId: input.organizationId,
        mediaSessionId: existing.id,
        streamStatus: "active",
        reconnectCount: ownership.record.reconnectCount,
      })
    }
    const transcript = await findActiveTranscriptSessionForMedia(admin, input.organizationId, existing.id)
    return {
      ok: true,
      mediaSessionId: existing.id,
      transcriptSessionId: transcript?.id ?? null,
      duplicate: true,
      message: "Existing active media stream session resumed.",
    }
  }

  const recording = await findLatestRecordingForCall(admin, input.organizationId, input.voiceCallId)
  const mediaSession = await insertMediaSession(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    voiceConferenceId: input.voiceConferenceId ?? null,
    voiceRecordingId: recording?.id ?? null,
    provider: input.provider,
    providerStreamSid: input.providerStreamSid,
    metadataJson: { customParameters: input.customParameters ?? {} },
  })

  acquireVoiceMediaStreamOwnership({
    connectionId: input.connectionId,
    organizationId: input.organizationId,
    mediaSessionId: mediaSession.id,
    providerStreamSid: input.providerStreamSid,
  })

  await updateMediaSessionStatus(admin, {
    organizationId: input.organizationId,
    mediaSessionId: mediaSession.id,
    streamStatus: "active",
  })

  await emitDeterministicMediaEvent(admin, {
    organizationId: input.organizationId,
    mediaSessionId: mediaSession.id,
    voiceCallId: input.voiceCallId,
    provider: input.provider,
    eventType: "stream_start",
    idempotencySuffix: input.providerStreamSid,
    payload: { providerStreamSid: input.providerStreamSid, voiceRecordingId: recording?.id ?? null },
  })

  const providerKind = resolveConfiguredTranscriptProviderKind()
  const transcriptProvider = createVoiceTranscriptProvider(providerKind)
  const startResult = await transcriptProvider.startTranscriptSession({
    mediaSessionId: mediaSession.id,
    voiceCallId: input.voiceCallId,
    organizationId: input.organizationId,
  })

  let transcriptSessionId: string | null = null
  if (startResult.ok && providerKind !== "none") {
    const transcriptSession = await insertTranscriptSession(admin, {
      organizationId: input.organizationId,
      mediaSessionId: mediaSession.id,
      voiceRecordingId: recording?.id ?? null,
      transcriptProvider: providerKind,
      metadataJson: { providerSessionRef: startResult.providerSessionRef },
    })
    transcriptSessionId = transcriptSession.id
    await updateTranscriptSessionStatus(admin, {
      organizationId: input.organizationId,
      transcriptSessionId: transcriptSession.id,
      transcriptStatus: "active",
    })
  }

  logVoiceInfrastructure("voice_media_stream_started", {
    mediaSessionId: mediaSession.id,
    voiceCallId: input.voiceCallId,
    providerStreamSid: input.providerStreamSid,
  })

  return {
    ok: true,
    mediaSessionId: mediaSession.id,
    transcriptSessionId,
    duplicate: false,
    message: "Media stream session started.",
  }
}

export async function registerVoiceMediaStreamParticipant(
  admin: SupabaseClient,
  input: {
    organizationId: string
    mediaSessionId: string
    voiceCallId: string
    provider: VoiceProviderId
    track?: string
    streamIdentity?: string
  },
): Promise<void> {
  const participant = await insertMediaParticipant(admin, {
    organizationId: input.organizationId,
    mediaSessionId: input.mediaSessionId,
    participantType: mapTwilioTrackToParticipantType(input.track),
    audioTrack: input.track === "inbound" ? "inbound_track" : input.track === "outbound" ? "outbound_track" : "mixed",
    streamIdentity: input.streamIdentity ?? input.track ?? "mixed",
  })

  await emitDeterministicMediaEvent(admin, {
    organizationId: input.organizationId,
    mediaSessionId: input.mediaSessionId,
    voiceCallId: input.voiceCallId,
    provider: input.provider,
    eventType: "participant_join",
    idempotencySuffix: participant.id,
    payload: { participantId: participant.id, track: input.track ?? null },
  })
}

export async function stopVoiceMediaStreamSession(
  admin: SupabaseClient,
  input: {
    organizationId: string
    mediaSessionId: string
    voiceCallId: string
    provider: VoiceProviderId
    connectionId: string
    providerStreamSid: string
  },
): Promise<void> {
  releaseVoiceMediaStreamOwnership(input.connectionId)

  const participants = await listActiveMediaParticipants(admin, input.organizationId, input.mediaSessionId)
  for (const participant of participants) {
    await deactivateMediaParticipant(admin, { organizationId: input.organizationId, participantId: participant.id })
    await emitDeterministicMediaEvent(admin, {
      organizationId: input.organizationId,
      mediaSessionId: input.mediaSessionId,
      voiceCallId: input.voiceCallId,
      provider: input.provider,
      eventType: "participant_leave",
      idempotencySuffix: participant.id,
      payload: { participantId: participant.id },
    })
  }

  await updateMediaSessionStatus(admin, {
    organizationId: input.organizationId,
    mediaSessionId: input.mediaSessionId,
    streamStatus: "stopped",
    endedAt: new Date().toISOString(),
  })

  await emitDeterministicMediaEvent(admin, {
    organizationId: input.organizationId,
    mediaSessionId: input.mediaSessionId,
    voiceCallId: input.voiceCallId,
    provider: input.provider,
    eventType: "stream_stop",
    idempotencySuffix: input.providerStreamSid,
    payload: { providerStreamSid: input.providerStreamSid },
  })

  const transcriptSession = await findActiveTranscriptSessionForMedia(admin, input.organizationId, input.mediaSessionId)
  if (transcriptSession) {
    const provider = createVoiceTranscriptProvider(transcriptSession.transcriptProvider)
    const providerSessionRef =
      typeof transcriptSession.metadataJson.providerSessionRef === "string"
        ? transcriptSession.metadataJson.providerSessionRef
        : transcriptSession.id
    await provider.finalizeTranscript(providerSessionRef)
    await updateTranscriptSessionStatus(admin, {
      organizationId: input.organizationId,
      transcriptSessionId: transcriptSession.id,
      transcriptStatus: "completed",
      endedAt: new Date().toISOString(),
    })
  }

  logVoiceInfrastructure("voice_media_stream_stopped", {
    mediaSessionId: input.mediaSessionId,
    voiceCallId: input.voiceCallId,
  })
}

export async function appendVoiceMediaInterruptionMark(
  admin: SupabaseClient,
  input: {
    organizationId: string
    mediaSessionId: string
    voiceCallId: string
    provider: VoiceProviderId
    markName: string
  },
): Promise<void> {
  await emitDeterministicMediaEvent(admin, {
    organizationId: input.organizationId,
    mediaSessionId: input.mediaSessionId,
    voiceCallId: input.voiceCallId,
    provider: input.provider,
    eventType: "media_interruption_mark",
    idempotencySuffix: input.markName,
    payload: { markName: input.markName },
  })
}

export async function ingestVoiceTranscriptProviderEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    mediaSessionId: string
    voiceCallId: string
    provider: VoiceProviderId
    rawEvent: unknown
    track?: string
  },
): Promise<{ appended: boolean; sequenceNumber: number | null }> {
  const transcriptSession = await findActiveTranscriptSessionForMedia(admin, input.organizationId, input.mediaSessionId)
  if (!transcriptSession) return { appended: false, sequenceNumber: null }

  const transcriptProvider = createVoiceTranscriptProvider(transcriptSession.transcriptProvider)
  const providerSessionRef =
    typeof transcriptSession.metadataJson.providerSessionRef === "string"
      ? transcriptSession.metadataJson.providerSessionRef
      : transcriptSession.id
  const appendResult = await transcriptProvider.appendTranscriptSegment(providerSessionRef, input.rawEvent)
  if (!appendResult.ok || !appendResult.normalized?.isFinal || !appendResult.normalized.transcriptText.trim()) {
    return { appended: false, sequenceNumber: null }
  }

  const normalized = appendResult.normalized
  const speakerType =
    normalized.speakerType === "unknown" ? mapTwilioTrackToSpeakerType(input.track) : normalized.speakerType
  const sequenceNumber = await getNextTranscriptSequenceNumber(admin, transcriptSession.id)
  const segment = await appendTranscriptSegment(admin, {
    organizationId: input.organizationId,
    transcriptSessionId: transcriptSession.id,
    speakerIdentity: normalized.speakerIdentity,
    speakerType,
    transcriptText: normalized.transcriptText,
    confidenceScore: normalized.confidenceScore,
    startedAt: normalized.startedAt,
    endedAt: normalized.endedAt,
    sequenceNumber,
    metadataJson: normalized.metadata ?? {},
  })

  await emitDeterministicMediaEvent(admin, {
    organizationId: input.organizationId,
    mediaSessionId: input.mediaSessionId,
    voiceCallId: input.voiceCallId,
    provider: input.provider,
    eventType: "transcript_segment_append",
    idempotencySuffix: `${transcriptSession.id}:${segment.sequenceNumber}`,
    payload: {
      transcriptSessionId: transcriptSession.id,
      sequenceNumber: segment.sequenceNumber,
      speakerType: segment.speakerType,
    },
  })

  try {
    await processTranscriptSegmentIntelligence(admin, {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
      transcriptSessionId: transcriptSession.id,
      transcriptSegmentId: segment.id,
      sequenceNumber: segment.sequenceNumber,
      speakerType: segment.speakerType,
      transcriptText: segment.transcriptText,
      confidenceScore: segment.confidenceScore,
    })
  } catch (intelligenceError) {
    logVoiceInfrastructure("voice_conversation_intelligence_failed", {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
      transcriptSegmentId: segment.id,
      message: intelligenceError instanceof Error ? intelligenceError.message : String(intelligenceError),
    })
  }

  return { appended: true, sequenceNumber: segment.sequenceNumber }
}

export async function processTwilioMediaStreamMessage(
  admin: SupabaseClient,
  input: {
    connectionId: string
    organizationId: string
    voiceCallId: string
    voiceConferenceId?: string | null
    frame: TwilioMediaStreamFrame
  },
): Promise<{ ok: boolean; message: string }> {
  const provider: VoiceProviderId = "twilio"

  if (input.frame.event === "connected") {
    return { ok: true, message: "Twilio media websocket connected." }
  }

  if (input.frame.event === "start") {
    const start = input.frame.start
    const providerStreamSid = start.streamSid || input.frame.streamSid || ""
    const result = await startVoiceMediaStreamSession(admin, {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
      voiceConferenceId: input.voiceConferenceId ?? null,
      provider,
      providerStreamSid,
      connectionId: input.connectionId,
      customParameters: start.customParameters,
    })
    for (const track of start.tracks ?? ["mixed"]) {
      await registerVoiceMediaStreamParticipant(admin, {
        organizationId: input.organizationId,
        mediaSessionId: result.mediaSessionId,
        voiceCallId: input.voiceCallId,
        provider,
        track,
        streamIdentity: track,
      })
    }
    return { ok: result.ok, message: result.message }
  }

  const mediaSession = await findActiveMediaSessionForCall(admin, input.organizationId, input.voiceCallId)
  if (!mediaSession) return { ok: false, message: "No active media session for call." }

  touchVoiceMediaStreamOwnership(input.connectionId)

  if (input.frame.event === "media") {
    const track = input.frame.media?.track
    await ingestVoiceTranscriptProviderEvent(admin, {
      organizationId: input.organizationId,
      mediaSessionId: mediaSession.id,
      voiceCallId: input.voiceCallId,
      provider,
      rawEvent: {
        transcript: "",
        track,
        is_final: false,
        metadata_only: true,
        timestamp: input.frame.media?.timestamp ?? null,
      },
      track,
    })
    return { ok: true, message: "Media frame received (audio not processed in Phase 1F)." }
  }

  if (input.frame.event === "mark") {
    const markName = input.frame.mark?.name ?? "unknown"
    await appendVoiceMediaInterruptionMark(admin, {
      organizationId: input.organizationId,
      mediaSessionId: mediaSession.id,
      voiceCallId: input.voiceCallId,
      provider,
      markName,
    })
    return { ok: true, message: "Media mark recorded." }
  }

  if (input.frame.event === "stop") {
    await stopVoiceMediaStreamSession(admin, {
      organizationId: input.organizationId,
      mediaSessionId: mediaSession.id,
      voiceCallId: input.voiceCallId,
      provider,
      connectionId: input.connectionId,
      providerStreamSid: mediaSession.providerStreamSid,
    })
    return { ok: true, message: "Media stream stopped." }
  }

  return { ok: false, message: "Unsupported media stream event." }
}

export async function fetchVoiceCallTranscriptSnapshot(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
  afterSequenceNumber?: number | null,
): Promise<VoiceCallTranscriptSnapshot> {
  const mediaSession = await findActiveMediaSessionForCall(admin, organizationId, voiceCallId)
  if (!mediaSession) {
    return {
      qaMarker: VOICE_MEDIA_STREAMING_QA_MARKER,
      connectionStatus: "unavailable",
      transcriptDelayMs: null,
      mediaSessionId: null,
      transcriptSessionId: null,
      segments: [],
      lastSequenceNumber: null,
    }
  }

  const transcriptSession = await findActiveTranscriptSessionForMedia(admin, organizationId, mediaSession.id)
  const segments = transcriptSession
    ? (await listTranscriptSegments(admin, {
        organizationId,
        transcriptSessionId: transcriptSession.id,
        afterSequenceNumber,
      })).map(toTranscriptSegmentPublicView)
    : []

  const connectionStatus =
    mediaSession.streamStatus === "active"
      ? "connected"
      : mediaSession.streamStatus === "connecting"
        ? "connecting"
        : mediaSession.streamStatus === "reconnecting"
          ? "reconnecting"
          : "disconnected"

  return {
    qaMarker: VOICE_MEDIA_STREAMING_QA_MARKER,
    connectionStatus,
    transcriptDelayMs: transcriptSession?.avgLatencyMs ?? null,
    mediaSessionId: mediaSession.id,
    transcriptSessionId: transcriptSession?.id ?? null,
    segments,
    lastSequenceNumber: segments.length ? segments[segments.length - 1]?.sequenceNumber ?? null : afterSequenceNumber ?? null,
  }
}

export async function fetchVoiceMediaCorrelationSnapshot(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<VoiceMediaCorrelationSnapshot> {
  const mediaSession = await findActiveMediaSessionForCall(admin, organizationId, voiceCallId)
  const transcriptSession = mediaSession
    ? await findActiveTranscriptSessionForMedia(admin, organizationId, mediaSession.id)
    : null
  const participants = mediaSession ? await listActiveMediaParticipants(admin, organizationId, mediaSession.id) : []

  return {
    qaMarker: VOICE_MEDIA_STREAMING_QA_MARKER,
    voiceCallId,
    mediaSessionId: mediaSession?.id ?? null,
    transcriptSessionId: transcriptSession?.id ?? null,
    voiceRecordingId: mediaSession?.voiceRecordingId ?? transcriptSession?.voiceRecordingId ?? null,
    voiceConferenceId: mediaSession?.voiceConferenceId ?? null,
    participantCount: participants.length,
  }
}

export async function runVoiceMediaStreamMaintenance(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ staleOwnershipCleaned: number; staleDbSessionsCleaned: number }> {
  const staleOwnershipCleaned = cleanupStaleVoiceMediaStreamOwnership(STALE_STREAM_MS)
  const staleBeforeIso = new Date(Date.now() - STALE_STREAM_MS).toISOString()
  const staleDbSessionsCleaned = await cleanupStaleMediaSessions(admin, { organizationId, staleBeforeIso })
  return { staleOwnershipCleaned, staleDbSessionsCleaned }
}

export async function fetchVoiceMediaStreamDiagnostics(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{
  activeStreamCount: number
  participantCount: number
  reconnectCount: number
  staleStreamsCleaned: number
  activeTranscriptSessions: number
}> {
  const ownership = getVoiceMediaStreamOwnershipMetrics()
  const activeStreamCount = await countActiveMediaSessions(admin, organizationId)
  const activeTranscriptSessions = await countActiveTranscriptSessions(admin, organizationId)
  const maintenance = await runVoiceMediaStreamMaintenance(admin, organizationId)

  return {
    activeStreamCount: Math.max(activeStreamCount, ownership.activeStreamCount),
    participantCount: ownership.activeStreamCount,
    reconnectCount: ownership.reconnectCount,
    staleStreamsCleaned: maintenance.staleDbSessionsCleaned + maintenance.staleOwnershipCleaned,
    activeTranscriptSessions,
  }
}

export async function ingestManualTranscriptSegmentForCall(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    speakerIdentity: string
    speakerType: VoiceSpeakerType
    transcriptText: string
    confidenceScore?: number | null
  },
): Promise<{ ok: boolean; sequenceNumber: number | null; message: string }> {
  const mediaSession = await findActiveMediaSessionForCall(admin, input.organizationId, input.voiceCallId)
  if (!mediaSession) {
    return { ok: false, sequenceNumber: null, message: "No active media session." }
  }

  const result = await ingestVoiceTranscriptProviderEvent(admin, {
    organizationId: input.organizationId,
    mediaSessionId: mediaSession.id,
    voiceCallId: input.voiceCallId,
    provider: "twilio",
    rawEvent: {
      speaker: input.speakerIdentity,
      speaker_type: input.speakerType,
      transcript_text: input.transcriptText,
      confidence_score: input.confidenceScore ?? null,
      is_final: true,
    },
  })

  return {
    ok: result.appended,
    sequenceNumber: result.sequenceNumber,
    message: result.appended ? "Transcript segment appended." : "Transcript segment not appended.",
  }
}

export async function getVoiceMediaSessionPublicView(
  admin: SupabaseClient,
  organizationId: string,
  mediaSessionId: string,
) {
  return findMediaSessionById(admin, organizationId, mediaSessionId)
}
