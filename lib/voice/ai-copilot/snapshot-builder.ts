/** AI copilot workspace snapshot builder — Phase 3A/3B. */

import type {
  VoiceAiCopilotProviderId,
  VoiceAiCopilotSuggestionPublicView,
  VoiceAiCopilotWorkspaceSnapshot,
} from "@/lib/voice/ai-copilot/types"
import {
  VOICE_AI_COPILOT_AUTONOMOUS_ACTIONS_DISABLED,
  VOICE_AI_COPILOT_EVIDENCE_REQUIRED,
  VOICE_AI_COPILOT_GUARDRAILS_ENABLED,
  VOICE_AI_COPILOT_MAX_SUGGESTIONS_PER_CALL,
  VOICE_AI_COPILOT_PASSIVE_MODE_ENABLED,
  VOICE_AI_COPILOT_QA_MARKER,
  VOICE_DEEP_COPILOT_QA_MARKER,
} from "@/lib/voice/ai-copilot/types"
import type {
  VoiceCopilotStrategySnapshot,
  VoiceOperatorPerformanceInsightPublicView,
} from "@/lib/voice/copilot-strategy/types"

const DRAFT_TYPES = new Set([
  "call_note_draft",
  "live_summary_draft",
  "follow_up_draft",
])

export function buildAiCopilotWorkspaceSnapshot(input: {
  voiceCallId: string
  providerMode: VoiceAiCopilotProviderId
  suggestions: VoiceAiCopilotSuggestionPublicView[]
  strategy?: VoiceCopilotStrategySnapshot | null
  performanceInsights?: VoiceOperatorPerformanceInsightPublicView[]
  generationCooldownRemainingMs: number
  canGenerate: boolean
}): VoiceAiCopilotWorkspaceSnapshot {
  const activeSuggestions = input.suggestions.filter((item) => item.status === "active")
  const topSuggestions = activeSuggestions.slice(0, 3)
  const draftSuggestions = activeSuggestions.filter((item) => DRAFT_TYPES.has(item.suggestionType))

  return {
    qaMarker: VOICE_AI_COPILOT_QA_MARKER,
    deepCopilotQaMarker: VOICE_DEEP_COPILOT_QA_MARKER,
    voiceCallId: input.voiceCallId,
    generatedAt: new Date().toISOString(),
    providerMode: input.providerMode,
    passiveModeEnabled: VOICE_AI_COPILOT_PASSIVE_MODE_ENABLED,
    autonomousActionsDisabled: VOICE_AI_COPILOT_AUTONOMOUS_ACTIONS_DISABLED,
    evidenceRequirementEnabled: VOICE_AI_COPILOT_EVIDENCE_REQUIRED,
    guardrailsEnabled: VOICE_AI_COPILOT_GUARDRAILS_ENABLED,
    maxSuggestionsPerCall: VOICE_AI_COPILOT_MAX_SUGGESTIONS_PER_CALL,
    activeSuggestions,
    topSuggestions,
    draftSuggestions,
    strategy: input.strategy ?? null,
    performanceInsights: input.performanceInsights ?? [],
    generationCooldownRemainingMs: input.generationCooldownRemainingMs,
    canGenerate: input.canGenerate,
    message: "AI copilot suggestions are operator-reviewed only. AI does not act automatically.",
  }
}
