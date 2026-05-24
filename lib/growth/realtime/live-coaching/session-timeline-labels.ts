/** Client-safe session timeline labels (Growth Engine slice 6.13A). */

import type {
  LiveCoachingSessionTimelineEventType,
  LiveCoachingSessionTimelineSeverity,
} from "@/lib/growth/realtime/live-coaching/session-timeline-types"
import { REALTIME_PROVIDER_LABELS } from "@/lib/growth/realtime/browser-audio/provider-labels"

export const SESSION_TIMELINE_EVENT_LABELS: Record<LiveCoachingSessionTimelineEventType, string> = {
  session_started: "Session started",
  mic_permission_granted: "Microphone permission granted",
  mic_permission_denied: "Microphone permission denied",
  provider_connecting: "Provider connecting",
  provider_connected: "Provider connected",
  provider_degraded: "Provider degraded",
  provider_disconnected: "Provider disconnected",
  provider_fallback_activated: "Provider fallback activated",
  transcript_chunk_received: "Transcript chunk received",
  transcript_finalized: "Transcript finalized",
  guidance_generated: "Guidance generated",
  objection_detected: "Objection detected",
  buying_signal_detected: "Buying signal detected",
  competitor_pressure_detected: "Competitor pressure detected",
  discovery_gap_detected: "Discovery gap detected",
  momentum_change: "Momentum change",
  execution_score_change: "Execution score change",
  provider_retry: "Provider retry",
  circuit_breaker_triggered: "Circuit breaker triggered",
  session_paused: "Session paused",
  session_resumed: "Session resumed",
  session_stopped: "Session stopped",
  session_completed: "Session completed",
  session_discarded: "Session discarded",
}

export function sessionTimelineEventLabel(eventType: LiveCoachingSessionTimelineEventType): string {
  return SESSION_TIMELINE_EVENT_LABELS[eventType] ?? eventType.replace(/_/g, " ")
}

export function sessionTimelineProviderLabel(providerId: string | null | undefined): string {
  if (!providerId) return "Manual"
  return REALTIME_PROVIDER_LABELS[providerId as keyof typeof REALTIME_PROVIDER_LABELS] ?? providerId
}

export function sessionTimelineSeverityTone(
  severity: LiveCoachingSessionTimelineSeverity,
): "healthy" | "attention" | "critical" | "neutral" {
  switch (severity) {
    case "critical":
      return "critical"
    case "warning":
      return "attention"
    default:
      return "neutral"
  }
}

export function formatSessionTimelineDetail(detail: Record<string, string | number | boolean | null>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(detail)) {
    if (value == null || value === "") continue
    parts.push(`${key.replace(/_/g, " ")}: ${String(value)}`)
  }
  return parts.slice(0, 4).join(" · ") || "Metrics recorded"
}
