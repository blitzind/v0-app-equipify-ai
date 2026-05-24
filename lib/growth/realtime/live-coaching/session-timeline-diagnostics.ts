/** Client-safe session timeline diagnostics (Growth Engine slice 6.13A). */

import { computeSessionTimelineHealthScore } from "@/lib/growth/realtime/live-coaching/session-timeline-health-score"
import type {
  LiveCoachingSessionTimelineDiagnostics,
  LiveCoachingSessionTimelineEvent,
} from "@/lib/growth/realtime/live-coaching/session-timeline-types"

export function buildSessionTimelineDiagnostics(
  events: LiveCoachingSessionTimelineEvent[],
): LiveCoachingSessionTimelineDiagnostics {
  const transcriptLatencyTrend = events
    .filter((event) =>
      event.eventType === "transcript_chunk_received" || event.eventType === "transcript_finalized",
    )
    .map((event) => ({
      at: event.createdAt,
      latencyMs: typeof event.detail.latencyMs === "number" ? event.detail.latencyMs : 0,
    }))
    .filter((entry) => entry.latencyMs > 0)
    .slice(-24)

  const providerInterruptions = events.filter(
    (event) => event.eventType === "provider_disconnected",
  ).length

  const reconnectCount = events.filter(
    (event) => event.eventType === "provider_retry" || event.eventType === "provider_connected",
  ).length

  const retryCount = events.filter((event) => event.eventType === "provider_retry").length
  const providerFailoverCount = events.filter(
    (event) => event.eventType === "provider_fallback_activated",
  ).length
  const providerDegradedEvents = events.filter(
    (event) => event.eventType === "provider_degraded",
  ).length

  const latencyValues = transcriptLatencyTrend.map((entry) => entry.latencyMs)
  const averageTranscriptLatencyMs =
    latencyValues.length > 0
      ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
      : 0

  return {
    transcriptLatencyTrend,
    providerInterruptions,
    reconnectCount,
    retryCount,
    providerFailoverCount,
    sessionHealthScore: computeSessionTimelineHealthScore({
      providerInterruptions,
      averageTranscriptLatencyMs,
      reconnectCount,
      retryCount,
      providerDegradedEvents,
    }),
  }
}

export function filterSessionTimelineEvents(
  events: LiveCoachingSessionTimelineEvent[],
  filters: {
    providerId?: string | null
    severity?: string | null
    eventType?: string | null
  },
): LiveCoachingSessionTimelineEvent[] {
  return events.filter((event) => {
    if (filters.providerId && filters.providerId !== "all") {
      if ((event.providerId ?? "manual") !== filters.providerId) return false
    }
    if (filters.severity && filters.severity !== "all" && event.severity !== filters.severity) {
      return false
    }
    if (filters.eventType && filters.eventType !== "all" && event.eventType !== filters.eventType) {
      return false
    }
    return true
  })
}
