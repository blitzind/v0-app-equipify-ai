/** Voice media streaming + transcript infrastructure — Phase 1F shared types (client-safe). */

export const VOICE_MEDIA_STREAMING_QA_MARKER = "voice-media-streaming-v1" as const

export const VOICE_MEDIA_DIRECTIONS = ["inbound", "outbound", "duplex"] as const
export type VoiceMediaDirection = (typeof VOICE_MEDIA_DIRECTIONS)[number]

export const VOICE_STREAM_STATUSES = ["connecting", "active", "reconnecting", "stopped", "failed"] as const
export type VoiceStreamStatus = (typeof VOICE_STREAM_STATUSES)[number]

export const VOICE_MEDIA_PARTICIPANT_TYPES = [
  "operator",
  "customer",
  "supervisor",
  "pstn",
  "browser",
  "unknown",
] as const
export type VoiceMediaParticipantType = (typeof VOICE_MEDIA_PARTICIPANT_TYPES)[number]

export const VOICE_AUDIO_TRACKS = ["inbound_track", "outbound_track", "mixed"] as const
export type VoiceAudioTrack = (typeof VOICE_AUDIO_TRACKS)[number]

export const VOICE_TRANSCRIPT_PROVIDER_KINDS = [
  "deepgram",
  "assemblyai",
  "openai_realtime",
  "stub",
  "none",
] as const
export type VoiceTranscriptProviderKind = (typeof VOICE_TRANSCRIPT_PROVIDER_KINDS)[number]

export const VOICE_TRANSCRIPT_SESSION_STATUSES = [
  "starting",
  "active",
  "paused",
  "finalizing",
  "completed",
  "failed",
] as const
export type VoiceTranscriptSessionStatus = (typeof VOICE_TRANSCRIPT_SESSION_STATUSES)[number]

export const VOICE_SPEAKER_TYPES = ["operator", "customer", "supervisor", "system", "unknown"] as const
export type VoiceSpeakerType = (typeof VOICE_SPEAKER_TYPES)[number]

export const VOICE_MEDIA_TIMELINE_EVENT_TYPES = [
  "stream_start",
  "stream_stop",
  "participant_join",
  "participant_leave",
  "stream_reconnect",
  "transcript_segment_append",
  "media_interruption_mark",
] as const
export type VoiceMediaTimelineEventType = (typeof VOICE_MEDIA_TIMELINE_EVENT_TYPES)[number]

export type VoiceMediaSessionRecord = {
  id: string
  organizationId: string
  voiceCallId: string
  voiceConferenceId: string | null
  voiceRecordingId: string | null
  provider: string
  providerStreamSid: string
  mediaDirection: VoiceMediaDirection
  streamStatus: VoiceStreamStatus
  startedAt: string | null
  endedAt: string | null
  reconnectCount: number
  metadataJson: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceMediaParticipantRecord = {
  id: string
  organizationId: string
  mediaSessionId: string
  voiceCallLegId: string | null
  participantType: VoiceMediaParticipantType
  audioTrack: VoiceAudioTrack
  streamIdentity: string
  isActive: boolean
  joinedAt: string | null
  leftAt: string | null
  metadataJson: Record<string, unknown>
  createdAt: string
}

export type VoiceTranscriptSessionRecord = {
  id: string
  organizationId: string
  mediaSessionId: string
  voiceRecordingId: string | null
  transcriptProvider: VoiceTranscriptProviderKind
  transcriptStatus: VoiceTranscriptSessionStatus
  startedAt: string | null
  endedAt: string | null
  avgLatencyMs: number | null
  metadataJson: Record<string, unknown>
  createdAt: string
}

export type VoiceTranscriptSegmentRecord = {
  id: string
  organizationId: string
  transcriptSessionId: string
  voiceCallLegId: string | null
  speakerIdentity: string
  speakerType: VoiceSpeakerType
  transcriptText: string
  confidenceScore: number | null
  startedAt: string | null
  endedAt: string | null
  sequenceNumber: number
  metadataJson: Record<string, unknown>
  createdAt: string
}

export type VoiceTranscriptSegmentPublicView = {
  id: string
  speakerIdentity: string
  speakerType: VoiceSpeakerType
  speakerLabel: string
  transcriptText: string
  confidenceScore: number | null
  startedAt: string | null
  endedAt: string | null
  sequenceNumber: number
}

export type VoiceMediaTimelineEventRecord = {
  id: string
  organizationId: string
  mediaSessionId: string
  voiceCallId: string
  eventType: VoiceMediaTimelineEventType
  eventTimestamp: string
  idempotencyKey: string
  payloadJson: Record<string, unknown>
  createdAt: string
}

export type VoiceMediaStreamDiagnostics = {
  activeStreamCount: number
  participantCount: number
  reconnectCount: number
  staleStreamsCleaned: number
}

export type VoiceMediaStreamingReadinessSnapshot = {
  qaMarker: typeof VOICE_MEDIA_STREAMING_QA_MARKER
  mediaStreamingReady: boolean
  twilioMediaStreamsReadiness: "ready" | "missing_credentials" | "schema_pending" | "stub_only"
  websocketReadiness: "route_scaffolded" | "upgrade_requires_proxy" | "schema_pending"
  transcriptProviderReadiness: "ready" | "stub_only" | "schema_pending" | "missing_credentials"
  streamHealth: "healthy" | "degraded" | "unknown"
  reconnectHealth: "healthy" | "degraded" | "unknown"
  activeTranscriptSessions: number
  transcriptProviderStatus: VoiceTranscriptProviderKind
  transcriptLatencyMs: number | null
  diagnostics: VoiceMediaStreamDiagnostics
  mediaStreamUrl: string
  message: string
  warnings: string[]
}

export type VoiceCallTranscriptSnapshot = {
  qaMarker: typeof VOICE_MEDIA_STREAMING_QA_MARKER
  connectionStatus: "connected" | "connecting" | "reconnecting" | "disconnected" | "unavailable"
  transcriptDelayMs: number | null
  mediaSessionId: string | null
  transcriptSessionId: string | null
  segments: VoiceTranscriptSegmentPublicView[]
  lastSequenceNumber: number | null
}

export type VoiceMediaCorrelationSnapshot = {
  qaMarker: typeof VOICE_MEDIA_STREAMING_QA_MARKER
  voiceCallId: string
  mediaSessionId: string | null
  transcriptSessionId: string | null
  voiceRecordingId: string | null
  voiceConferenceId: string | null
  participantCount: number
}
