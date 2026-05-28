/** Revenue event deduplication — deterministic, evidence keyed. */

import type {
  DerivedRevenueIntelligenceEventInput,
  VoiceRevenueIntelligenceEventPublicView,
} from "@/lib/voice/revenue-intelligence/types"

export function buildRevenueIntelligenceDedupeKey(
  eventType: string,
  evidenceText: string,
  relationshipMemoryProfileId: string | null,
  relatedOpportunityId: string | null,
): string {
  const normalizedEvidence = evidenceText.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 160)
  return [eventType, relationshipMemoryProfileId ?? "none", relatedOpportunityId ?? "none", normalizedEvidence].join("::")
}

export function dedupeRevenueIntelligenceEvents(
  events: VoiceRevenueIntelligenceEventPublicView[],
): VoiceRevenueIntelligenceEventPublicView[] {
  const seen = new Set<string>()
  const result: VoiceRevenueIntelligenceEventPublicView[] = []
  for (const event of events) {
    const key = buildRevenueIntelligenceDedupeKey(
      event.eventType,
      event.evidenceText,
      event.relationshipMemoryProfileId,
      event.relatedOpportunityId,
    )
    if (seen.has(key)) continue
    seen.add(key)
    result.push(event)
  }
  return result
}

export function isDuplicateRevenueIntelligenceEvent(
  existing: VoiceRevenueIntelligenceEventPublicView[],
  candidate: DerivedRevenueIntelligenceEventInput,
  relationshipMemoryProfileId: string | null,
  relatedOpportunityId: string | null,
): boolean {
  const key = buildRevenueIntelligenceDedupeKey(
    candidate.eventType,
    candidate.evidenceText,
    relationshipMemoryProfileId,
    relatedOpportunityId,
  )
  return existing.some(
    (event) =>
      buildRevenueIntelligenceDedupeKey(
        event.eventType,
        event.evidenceText,
        event.relationshipMemoryProfileId,
        event.relatedOpportunityId,
      ) === key,
  )
}

export function isStaleRevenueIntelligenceEvent(createdAt: string, staleDays: number): boolean {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  const ageMs = Date.now() - created
  return ageMs > staleDays * 24 * 60 * 60 * 1000
}
