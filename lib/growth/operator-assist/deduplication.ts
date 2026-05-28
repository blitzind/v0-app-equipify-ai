/** Deterministic deduplication for unified operator assist feed. */

import type { UnifiedOperatorAssistEvent } from "@/lib/growth/operator-assist/types"

function normalizeEvidence(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 160)
}

export function buildAssistDedupeKey(input: {
  category: string
  eventType: string
  evidenceText: string
}): string {
  return `${input.category}:${input.eventType}:${normalizeEvidence(input.evidenceText)}`
}

export function dedupeUnifiedAssistEvents(events: UnifiedOperatorAssistEvent[]): UnifiedOperatorAssistEvent[] {
  const byKey = new Map<string, UnifiedOperatorAssistEvent>()
  for (const event of events) {
    const existing = byKey.get(event.dedupeKey)
    if (!existing) {
      byKey.set(event.dedupeKey, event)
      continue
    }
    if (event.priorityScore > existing.priorityScore) {
      byKey.set(event.dedupeKey, event)
      continue
    }
    if (event.priorityScore === existing.priorityScore && event.confidenceScore > existing.confidenceScore) {
      byKey.set(event.dedupeKey, event)
    }
  }
  return [...byKey.values()]
}

export function preferGrowthGuidanceOnConflict(
  events: UnifiedOperatorAssistEvent[],
): UnifiedOperatorAssistEvent[] {
  const growthKeys = new Set(
    events.filter((event) => event.source === "growth_guidance").map((event) => event.dedupeKey),
  )
  return events.filter((event) => {
    if (event.source !== "voice_intelligence") return true
    return !growthKeys.has(event.dedupeKey)
  })
}
