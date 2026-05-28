/** Structured output validation for AI copilot drafts — Phase 3B. */

import type { VoiceAiCopilotGenerationDraft, VoiceAiCopilotSuggestionType } from "@/lib/voice/ai-copilot/types"
import { VOICE_AI_COPILOT_SUGGESTION_TYPES } from "@/lib/voice/ai-copilot/types"
import { VOICE_DEEP_COPILOT_STRUCTURED_OUTPUT_MAX_DRAFTS } from "@/lib/voice/copilot-strategy/types"

const VALID_TYPES = new Set<string>(VOICE_AI_COPILOT_SUGGESTION_TYPES)

export function sanitizeCopilotStructuredDraft(raw: unknown): VoiceAiCopilotGenerationDraft | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Record<string, unknown>
  const suggestionType = item.suggestionType
  if (typeof suggestionType !== "string" || !VALID_TYPES.has(suggestionType)) return null

  const title = typeof item.title === "string" ? item.title.trim() : ""
  const body = typeof item.body === "string" ? item.body.trim() : ""
  const evidenceText = typeof item.evidenceText === "string" ? item.evidenceText.trim() : ""
  if (!title || !body || evidenceText.length < 8) return null

  const priorityRaw = Number(item.priority)
  const priority = Number.isFinite(priorityRaw) ? Math.max(0, Math.min(100, Math.round(priorityRaw))) : 50
  const sourceEventIds = Array.isArray(item.sourceEventIds)
    ? item.sourceEventIds.filter((id): id is string => typeof id === "string")
    : []

  return {
    suggestionType: suggestionType as VoiceAiCopilotSuggestionType,
    priority,
    title: title.slice(0, 200),
    body: body.slice(0, 2000),
    evidenceText: evidenceText.slice(0, 500),
    sourceEventIds: sourceEventIds.slice(0, 12),
  }
}

export function validateAndSanitizeStructuredDrafts(raw: unknown): VoiceAiCopilotGenerationDraft[] {
  if (!Array.isArray(raw)) return []
  const result: VoiceAiCopilotGenerationDraft[] = []
  for (const item of raw) {
    const draft = sanitizeCopilotStructuredDraft(item)
    if (draft) result.push(draft)
    if (result.length >= VOICE_DEEP_COPILOT_STRUCTURED_OUTPUT_MAX_DRAFTS) break
  }
  return result
}
