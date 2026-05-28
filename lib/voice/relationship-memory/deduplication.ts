/** Memory event deduplication — deterministic, evidence keyed. */

import { buildMemoryEvidenceDedupeKey } from "@/lib/voice/relationship-memory/draft-mapping"
import type { VoiceRelationshipMemoryEventPublicView } from "@/lib/voice/relationship-memory/types"

export function dedupeRelationshipMemoryEvents(
  events: VoiceRelationshipMemoryEventPublicView[],
): VoiceRelationshipMemoryEventPublicView[] {
  const byKey = new Map<string, VoiceRelationshipMemoryEventPublicView>()
  for (const event of events) {
    const key = buildMemoryEvidenceDedupeKey(event.memoryType, event.evidenceText)
    const existing = byKey.get(key)
    if (!existing || event.confidenceScore > existing.confidenceScore) {
      byKey.set(key, event)
    }
  }
  return [...byKey.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function isDuplicateMemoryEvent(
  existingEvents: VoiceRelationshipMemoryEventPublicView[],
  input: { memoryType: string; evidenceText: string },
): boolean {
  const key = buildMemoryEvidenceDedupeKey(input.memoryType, input.evidenceText)
  return existingEvents.some(
    (event) => buildMemoryEvidenceDedupeKey(event.memoryType, event.evidenceText) === key,
  )
}
