/** Deterministic session insights rollup from timeline events (Growth Engine slice 6.13B). */

import { computeSessionTimelineHealthScore } from "@/lib/growth/realtime/live-coaching/session-timeline-health-score"
import type { LiveCoachingSessionTimelineEvent } from "@/lib/growth/realtime/live-coaching/session-timeline-types"
import { computeSessionInsightsRiskLevel } from "@/lib/growth/realtime/live-coaching/session-insights-risk-level"
import type { LiveCoachingSessionInsightsRollup } from "@/lib/growth/realtime/live-coaching/session-insights-types"

function countEvents(
  events: LiveCoachingSessionTimelineEvent[],
  eventType: LiveCoachingSessionTimelineEvent["eventType"],
): number {
  return events.filter((event) => event.eventType === eventType).length
}

function computeSessionDurationMs(events: LiveCoachingSessionTimelineEvent[]): number {
  const started = events.find((event) => event.eventType === "session_started")
  const ended = [...events]
    .reverse()
    .find((event) =>
      event.eventType === "session_completed" ||
      event.eventType === "session_discarded" ||
      event.eventType === "session_stopped",
    )

  if (started && ended) {
    return Math.max(0, new Date(ended.createdAt).getTime() - new Date(started.createdAt).getTime())
  }

  const completedDuration = events.find((event) => event.eventType === "session_completed")?.detail
    .durationMs
  if (typeof completedDuration === "number" && completedDuration > 0) {
    return completedDuration
  }

  return 0
}

function resolvePrimaryProviderId(events: LiveCoachingSessionTimelineEvent[]): string | null {
  const lastConnected = [...events]
    .reverse()
    .find((event) => event.eventType === "provider_connected" && event.providerId)
  if (lastConnected?.providerId) return lastConnected.providerId

  const counts = new Map<string, number>()
  for (const event of events) {
    if (!event.providerId) continue
    counts.set(event.providerId, (counts.get(event.providerId) ?? 0) + 1)
  }

  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  return ranked[0]?.[0] ?? null
}

function collectTranscriptLatencies(events: LiveCoachingSessionTimelineEvent[]): number[] {
  return events
    .filter(
      (event) =>
        event.eventType === "transcript_finalized" || event.eventType === "transcript_chunk_received",
    )
    .map((event) => (typeof event.detail.latencyMs === "number" ? event.detail.latencyMs : 0))
    .filter((value) => value > 0)
}

export function buildLiveCoachingSessionInsightsRollup(input: {
  leadId: string
  sessionId: string
  events: LiveCoachingSessionTimelineEvent[]
  computedAt?: string
}): LiveCoachingSessionInsightsRollup {
  const events = [...input.events].sort((left, right) => left.sequenceNumber - right.sequenceNumber)
  const latencies = collectTranscriptLatencies(events)
  const averageTranscriptLatencyMs =
    latencies.length > 0
      ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
      : 0
  const maxTranscriptLatencyMs = latencies.length > 0 ? Math.max(...latencies) : 0

  const providerInterruptions = countEvents(events, "provider_disconnected")
  const retryAttempts = countEvents(events, "provider_retry")
  const reconnectAttempts = Math.max(0, countEvents(events, "provider_connected") - 1)
  const fallbackCount = countEvents(events, "provider_fallback_activated")
  const providerDegradedCount = countEvents(events, "provider_degraded")
  const circuitBreakerTriggered = countEvents(events, "circuit_breaker_triggered") > 0

  const meetingCaptureStarted = events.filter((event) => event.eventType === "meeting_capture_started")
  const meetingModeUsed = meetingCaptureStarted.some(
    (event) =>
      event.detail.captureSourceMode !== "microphone" &&
      event.detail.captureSourceMode != null,
  )
  const mixedAudioUsed = countEvents(events, "mixed_audio_enabled") > 0
  const meetingCaptureFailures =
    countEvents(events, "meeting_capture_failed") +
    countEvents(events, "meeting_audio_permission_denied")
  const detectedProviderEvent = [...events]
    .reverse()
    .find((event) => event.eventType === "meeting_provider_detected")
  const meetingProvider =
    typeof detectedProviderEvent?.detail.meetingProvider === "string"
      ? detectedProviderEvent.detail.meetingProvider
      : null

  const sessionHealthScore = computeSessionTimelineHealthScore({
    providerInterruptions,
    averageTranscriptLatencyMs,
    reconnectCount: reconnectAttempts,
    retryCount: retryAttempts,
    providerDegradedEvents: providerDegradedCount,
  })

  const riskLevel = computeSessionInsightsRiskLevel({
    sessionHealthScore,
    providerInterruptions,
    retryAttempts,
    fallbackCount,
    circuitBreakerTriggered,
    objectionCount: countEvents(events, "objection_detected"),
    competitorPressureCount: countEvents(events, "competitor_pressure_detected"),
    providerDegradedCount,
  })

  return {
    sessionId: input.sessionId,
    leadId: input.leadId,
    sessionDurationMs: computeSessionDurationMs(events),
    providerId: resolvePrimaryProviderId(events),
    transcriptFinalizedCount: countEvents(events, "transcript_finalized"),
    guidanceGeneratedCount: countEvents(events, "guidance_generated"),
    objectionCount: countEvents(events, "objection_detected"),
    buyingSignalCount: countEvents(events, "buying_signal_detected"),
    discoveryGapCount: countEvents(events, "discovery_gap_detected"),
    competitorPressureCount: countEvents(events, "competitor_pressure_detected"),
    providerInterruptions,
    reconnectAttempts,
    retryAttempts,
    fallbackCount,
    averageTranscriptLatencyMs,
    maxTranscriptLatencyMs,
    sessionHealthScore,
    riskLevel,
    meetingModeUsed,
    meetingProvider,
    mixedAudioUsed,
    meetingCaptureFailures,
    computedAt: input.computedAt ?? new Date().toISOString(),
  }
}

export function toLiveCoachingSessionInsightsPreview(
  rollup: LiveCoachingSessionInsightsRollup,
): Pick<
  LiveCoachingSessionInsightsRollup,
  | "sessionHealthScore"
  | "riskLevel"
  | "providerId"
  | "transcriptFinalizedCount"
  | "providerInterruptions"
  | "retryAttempts"
  | "sessionDurationMs"
> {
  return {
    sessionHealthScore: rollup.sessionHealthScore,
    riskLevel: rollup.riskLevel,
    providerId: rollup.providerId,
    transcriptFinalizedCount: rollup.transcriptFinalizedCount,
    providerInterruptions: rollup.providerInterruptions,
    retryAttempts: rollup.retryAttempts,
    sessionDurationMs: rollup.sessionDurationMs,
  }
}
