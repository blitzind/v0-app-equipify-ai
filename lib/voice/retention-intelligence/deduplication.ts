/** Retention event deduplication — deterministic, evidence keyed. */

import type {
  DerivedRetentionIntelligenceEventInput,
  VoiceRetentionIntelligenceEventPublicView,
} from "@/lib/voice/retention-intelligence/types"

export function buildRetentionIntelligenceDedupeKey(
  eventType: string,
  evidenceText: string,
  relationshipMemoryProfileId: string | null,
  relatedCustomerId: string | null,
): string {
  const normalizedEvidence = evidenceText.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 160)
  return [eventType, relationshipMemoryProfileId ?? "none", relatedCustomerId ?? "none", normalizedEvidence].join("::")
}

export function dedupeRetentionIntelligenceEvents(
  events: VoiceRetentionIntelligenceEventPublicView[],
): VoiceRetentionIntelligenceEventPublicView[] {
  const seen = new Set<string>()
  const result: VoiceRetentionIntelligenceEventPublicView[] = []
  for (const event of events) {
    const key = buildRetentionIntelligenceDedupeKey(
      event.eventType,
      event.evidenceText,
      event.relationshipMemoryProfileId,
      event.relatedCustomerId,
    )
    if (seen.has(key)) continue
    seen.add(key)
    result.push(event)
  }
  return result
}

export function isDuplicateRetentionIntelligenceEvent(
  existing: VoiceRetentionIntelligenceEventPublicView[],
  candidate: DerivedRetentionIntelligenceEventInput,
  relationshipMemoryProfileId: string | null,
  relatedCustomerId: string | null,
): boolean {
  const key = buildRetentionIntelligenceDedupeKey(
    candidate.eventType,
    candidate.evidenceText,
    relationshipMemoryProfileId,
    relatedCustomerId,
  )
  return existing.some(
    (event) =>
      buildRetentionIntelligenceDedupeKey(
        event.eventType,
        event.evidenceText,
        event.relationshipMemoryProfileId,
        event.relatedCustomerId,
      ) === key,
  )
}

export function isStaleRetentionIntelligenceEvent(createdAt: string, staleDays: number): boolean {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  return Date.now() - created > staleDays * 24 * 60 * 60 * 1000
}
