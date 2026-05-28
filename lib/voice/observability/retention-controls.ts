/** Observability retention + sampling controls — Phase 5B. */

import {
  VOICE_OBSERVABILITY_EVENT_RETENTION_DAYS,
  VOICE_OBSERVABILITY_EVENT_SAMPLE_RATE,
  VOICE_OBSERVABILITY_MAX_EVENTS_QUERY,
  VOICE_OBSERVABILITY_MAX_REALTIME_ITEMS,
  VOICE_OBSERVABILITY_SNAPSHOT_RETENTION_DAYS,
} from "@/lib/voice/observability/types"

export function observabilityRetentionCutoffIso(): string {
  return new Date(Date.now() - VOICE_OBSERVABILITY_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

export function observabilitySnapshotRetentionCutoffIso(): string {
  return new Date(Date.now() - VOICE_OBSERVABILITY_SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

export function rollingWindowStartIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

export function shouldSampleObservabilityEvent(eventType: string): boolean {
  if (VOICE_OBSERVABILITY_EVENT_SAMPLE_RATE >= 1) return true
  if (eventType.includes("critical") || eventType.includes("escalation") || eventType.includes("blocked")) {
    return true
  }
  return Math.random() < VOICE_OBSERVABILITY_EVENT_SAMPLE_RATE
}

export function capEventsQuery<T>(items: T[]): T[] {
  return items.slice(0, VOICE_OBSERVABILITY_MAX_EVENTS_QUERY)
}

export function capRealtimePayload<T>(items: T[]): T[] {
  return items.slice(0, VOICE_OBSERVABILITY_MAX_REALTIME_ITEMS)
}

export function stripTranscriptPayload(metadata: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...metadata }
  for (const key of ["transcript", "transcriptText", "spokenText", "callerText", "calleeText", "payload"]) {
    if (key in cleaned) delete cleaned[key]
  }
  return cleaned
}
