/** AI copilot suggestion deduplication — Phase 3A. */

import type { VoiceAiCopilotGenerationDraft, VoiceAiCopilotSuggestionPublicView } from "@/lib/voice/ai-copilot/types"
import { VOICE_AI_COPILOT_EVIDENCE_DEDUPE_CHARS } from "@/lib/voice/ai-copilot/types"

function normalizeDedupeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, VOICE_AI_COPILOT_EVIDENCE_DEDUPE_CHARS)
}

export function buildCopilotDedupeKey(draft: Pick<VoiceAiCopilotGenerationDraft, "suggestionType" | "title" | "evidenceText">): string {
  return `${draft.suggestionType}:${normalizeDedupeText(draft.title)}:${normalizeDedupeText(draft.evidenceText)}`
}

export function isDuplicateCopilotSuggestion(
  existing: VoiceAiCopilotSuggestionPublicView[],
  draft: VoiceAiCopilotGenerationDraft,
): boolean {
  const key = buildCopilotDedupeKey(draft)
  return existing.some((item) => buildCopilotDedupeKey(item) === key)
}

export function dedupeCopilotDrafts(drafts: VoiceAiCopilotGenerationDraft[]): VoiceAiCopilotGenerationDraft[] {
  const seen = new Set<string>()
  const result: VoiceAiCopilotGenerationDraft[] = []
  for (const draft of drafts) {
    const key = buildCopilotDedupeKey(draft)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(draft)
  }
  return result
}

export function isStaleCopilotSuggestion(createdAt: string, staleMinutes: number): boolean {
  const ageMs = Date.now() - new Date(createdAt).getTime()
  return ageMs > staleMinutes * 60 * 1000
}
