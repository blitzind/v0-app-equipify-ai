/** Escalation analytics — Phase 5B. */

import type { VoiceObservabilityEscalationSnapshot } from "@/lib/voice/observability/types"
import { VOICE_OBSERVABILITY_QA_MARKER } from "@/lib/voice/observability/types"

export type EscalationSourceRow = {
  sourceSystem: string
  eventType: string
  createdAt: string
}

export function buildEscalationAnalyticsSnapshot(input: {
  events: EscalationSourceRow[]
  windowHours: number
}): VoiceObservabilityEscalationSnapshot {
  const escalationEvents = input.events.filter(
    (e) =>
      e.eventType.includes("escalation") ||
      e.eventType.includes("transfer") ||
      e.eventType === "operator_joined" ||
      e.eventType === "operator_takeover",
  )

  const escalationCount = escalationEvents.filter((e) => e.eventType.includes("escalation")).length
  const operatorTakeoverCount = escalationEvents.filter(
    (e) => e.eventType === "operator_joined" || e.eventType.includes("takeover"),
  ).length
  const transferCount = escalationEvents.filter((e) => e.eventType.includes("transfer")).length

  const bySource = new Map<string, number>()
  for (const event of escalationEvents) {
    const key = event.sourceSystem || "unknown"
    bySource.set(key, (bySource.get(key) ?? 0) + 1)
  }

  const heatmap = buildHourlyHeatmap(escalationEvents)

  return {
    qaMarker: VOICE_OBSERVABILITY_QA_MARKER,
    generatedAt: new Date().toISOString(),
    escalationCount24h: escalationCount,
    operatorTakeoverCount24h: operatorTakeoverCount,
    transferCount24h: transferCount,
    bySourceSystem: [...bySource.entries()]
      .map(([sourceSystem, count]) => ({ sourceSystem, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    heatmap,
    message: "Escalation and operator takeover trends — visibility only.",
  }
}

function buildHourlyHeatmap(events: EscalationSourceRow[]): Array<{ hour: number; count: number }> {
  const buckets = new Map<number, number>()
  for (let h = 0; h < 24; h += 1) buckets.set(h, 0)

  for (const event of events) {
    const hour = new Date(event.createdAt).getHours()
    buckets.set(hour, (buckets.get(hour) ?? 0) + 1)
  }

  return [...buckets.entries()].map(([hour, count]) => ({ hour, count }))
}
