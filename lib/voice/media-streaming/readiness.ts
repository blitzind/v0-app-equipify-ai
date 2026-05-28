import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildVoiceMediaStreamTwilioUrl } from "@/lib/voice/call-control/urls"
import type { VoiceMediaStreamingReadinessSnapshot } from "@/lib/voice/media-streaming/types"
import { VOICE_MEDIA_STREAMING_QA_MARKER } from "@/lib/voice/media-streaming/types"
import { fetchVoiceMediaStreamDiagnostics } from "@/lib/voice/media-streaming/media-session-service"
import { resolveConfiguredTranscriptProviderKind } from "@/lib/voice/transcripts/providers/types"

export async function fetchVoiceMediaStreamingReadiness(
  admin: SupabaseClient,
  organizationId: string,
  origin?: string | null,
): Promise<VoiceMediaStreamingReadinessSnapshot> {
  const warnings: string[] = []
  const hasTwilioCredentials = Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim(),
  )

  let schemaReady = true
  for (const table of [
    "voice_media_sessions",
    "voice_media_participants",
    "voice_transcript_sessions",
    "voice_transcript_segments",
    "voice_media_timeline_events",
  ]) {
    const { error } = await admin.schema("voice").from(table).select("id").limit(0)
    if (error) {
      schemaReady = false
      warnings.push(`Missing or inaccessible table voice.${table}. Apply migration 20270606120000.`)
      break
    }
  }

  const transcriptProviderStatus = resolveConfiguredTranscriptProviderKind()
  let twilioMediaStreamsReadiness: VoiceMediaStreamingReadinessSnapshot["twilioMediaStreamsReadiness"] = "stub_only"
  let websocketReadiness: VoiceMediaStreamingReadinessSnapshot["websocketReadiness"] = "route_scaffolded"
  let transcriptProviderReadiness: VoiceMediaStreamingReadinessSnapshot["transcriptProviderReadiness"] = "stub_only"

  if (!schemaReady) {
    twilioMediaStreamsReadiness = "schema_pending"
    websocketReadiness = "schema_pending"
    transcriptProviderReadiness = "schema_pending"
  } else if (hasTwilioCredentials) {
    twilioMediaStreamsReadiness = "ready"
    transcriptProviderReadiness =
      transcriptProviderStatus === "stub" || transcriptProviderStatus === "none"
        ? "stub_only"
        : "ready"
  } else {
    warnings.push("Twilio credentials not configured — media stream ingestion runs in stub mode.")
  }

  if (process.env.VOICE_MEDIA_WEBSOCKET_UPGRADE_ENABLED?.trim() !== "true") {
    warnings.push(
      "Twilio Media Streams websocket upgrade requires VOICE_MEDIA_WEBSOCKET_UPGRADE_ENABLED=true or an external WS proxy.",
    )
    websocketReadiness = "upgrade_requires_proxy"
  }

  if (transcriptProviderStatus === "deepgram" && !process.env.DEEPGRAM_API_KEY?.trim()) {
    transcriptProviderReadiness = "missing_credentials"
    warnings.push("Set DEEPGRAM_API_KEY for Deepgram transcript provider.")
  }
  if (transcriptProviderStatus === "assemblyai" && !process.env.ASSEMBLYAI_API_KEY?.trim()) {
    transcriptProviderReadiness = "missing_credentials"
    warnings.push("Set ASSEMBLYAI_API_KEY for AssemblyAI transcript provider.")
  }

  const diagnostics = schemaReady
    ? await fetchVoiceMediaStreamDiagnostics(admin, organizationId)
    : {
        activeStreamCount: 0,
        participantCount: 0,
        reconnectCount: 0,
        staleStreamsCleaned: 0,
        activeTranscriptSessions: 0,
      }

  const mediaStreamingReady =
    schemaReady &&
    (twilioMediaStreamsReadiness === "ready" || twilioMediaStreamsReadiness === "stub_only") &&
    (transcriptProviderReadiness === "ready" || transcriptProviderReadiness === "stub_only")

  return {
    qaMarker: VOICE_MEDIA_STREAMING_QA_MARKER,
    mediaStreamingReady,
    twilioMediaStreamsReadiness,
    websocketReadiness,
    transcriptProviderReadiness,
    streamHealth: diagnostics.activeStreamCount > 0 ? "healthy" : "unknown",
    reconnectHealth: diagnostics.reconnectCount > 0 ? "degraded" : "healthy",
    activeTranscriptSessions: diagnostics.activeTranscriptSessions,
    transcriptProviderStatus,
    transcriptLatencyMs: null,
    diagnostics: {
      activeStreamCount: diagnostics.activeStreamCount,
      participantCount: diagnostics.participantCount,
      reconnectCount: diagnostics.reconnectCount,
      staleStreamsCleaned: diagnostics.staleStreamsCleaned,
    },
    mediaStreamUrl: buildVoiceMediaStreamTwilioUrl(origin),
    message: mediaStreamingReady
      ? "Realtime media streaming + transcript infrastructure scaffolding is ready."
      : "Apply voice media streaming migration 20270606120000 before enabling live media streams.",
    warnings,
  }
}
