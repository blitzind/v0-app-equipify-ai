/** Client-safe Live Coaching session timeline types (Growth Engine slice 6.13A). */

export const LIVE_COACHING_SESSION_TIMELINE_EVENT_TYPES = [
  "session_started",
  "mic_permission_granted",
  "mic_permission_denied",
  "provider_connecting",
  "provider_connected",
  "provider_degraded",
  "provider_disconnected",
  "provider_fallback_activated",
  "transcript_chunk_received",
  "transcript_finalized",
  "guidance_generated",
  "objection_detected",
  "buying_signal_detected",
  "competitor_pressure_detected",
  "discovery_gap_detected",
  "momentum_change",
  "execution_score_change",
  "provider_retry",
  "circuit_breaker_triggered",
  "session_paused",
  "session_resumed",
  "session_stopped",
  "session_completed",
  "session_discarded",
  "meeting_capture_started",
  "meeting_capture_stopped",
  "meeting_provider_detected",
  "mixed_audio_enabled",
  "meeting_audio_permission_denied",
  "meeting_capture_failed",
] as const

export type LiveCoachingSessionTimelineEventType =
  (typeof LIVE_COACHING_SESSION_TIMELINE_EVENT_TYPES)[number]

export const LIVE_COACHING_SESSION_TIMELINE_SEVERITIES = ["info", "warning", "critical"] as const

export type LiveCoachingSessionTimelineSeverity =
  (typeof LIVE_COACHING_SESSION_TIMELINE_SEVERITIES)[number]

export type LiveCoachingSessionTimelineDetail = Record<string, string | number | boolean | null>

export type LiveCoachingSessionTimelineEvent = {
  id: string
  leadId: string
  sessionId: string
  sequenceNumber: number
  eventType: LiveCoachingSessionTimelineEventType
  severity: LiveCoachingSessionTimelineSeverity
  providerId: string | null
  detail: LiveCoachingSessionTimelineDetail
  createdAt: string
}

export type LiveCoachingSessionTimelineDiagnostics = {
  transcriptLatencyTrend: Array<{ at: string; latencyMs: number }>
  providerInterruptions: number
  reconnectCount: number
  retryCount: number
  providerFailoverCount: number
  sessionHealthScore: number
}

export type LiveCoachingSessionTimelinePayload = {
  events: LiveCoachingSessionTimelineEvent[]
  diagnostics: LiveCoachingSessionTimelineDiagnostics
  meta: {
    total: number
    limit: number
    truncated: boolean
  }
  qaProof: {
    marker: string
    label: string
    verified: boolean
  }
}
