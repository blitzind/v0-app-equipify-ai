/** Adaptive copilot prioritization — Phase 3B. */

import type { VoiceAiCopilotGenerationDraft } from "@/lib/voice/ai-copilot/types"
import type { VoiceCopilotStrategySnapshot } from "@/lib/voice/copilot-strategy/types"
import {
  VOICE_DEEP_COPILOT_LOW_PRIORITY_SUPPRESSION_SCORE,
  VOICE_DEEP_COPILOT_MAX_ACTIVE_SUGGESTIONS,
  VOICE_DEEP_COPILOT_OVERLOAD_ASSIST_THRESHOLD,
} from "@/lib/voice/copilot-strategy/types"

const ESCALATION_PRIORITY_TYPES = new Set([
  "de_escalation_prompt",
  "escalation_recommendation",
  "rapport_repair",
  "compliance_recovery_prompt",
  "operator_interrupt_alert",
])

const LOW_VALUE_DURING_ESCALATION = new Set([
  "discovery_question",
  "expansion_conversation_prompt",
  "booking_prompt",
  "compliance_reminder",
])

const PHASE_BOOST: Partial<Record<string, Partial<Record<string, number>>>> = {
  objection_handling: { objection_strategy: 12, objection_response: 10, de_escalation_prompt: 8 },
  escalation_risk: { de_escalation_prompt: 15, rapport_repair: 12, operator_interrupt_alert: 10 },
  discovery: { qualification_gap: 10, discovery_question: 8 },
  pricing_discussion: { pricing_positioning: 12, objection_response: 8 },
  booking_attempt: { close_timing_suggestion: 10, booking_prompt: 8 },
  retention_recovery: { retention_recovery_prompt: 12, retention_response: 10 },
}

export function applyAdaptiveCopilotPrioritization(
  drafts: VoiceAiCopilotGenerationDraft[],
  strategy: VoiceCopilotStrategySnapshot,
  activeAssistEventCount: number,
): VoiceAiCopilotGenerationDraft[] {
  const escalationMode =
    strategy.escalationLikelihood.level === "elevated" || strategy.escalationLikelihood.level === "critical"
  const overload = activeAssistEventCount >= VOICE_DEEP_COPILOT_OVERLOAD_ASSIST_THRESHOLD || strategy.overloadPreventionActive

  const weighted = drafts
    .map((draft) => {
      let priority = draft.priority
      const phaseBoost = PHASE_BOOST[strategy.conversationPhase.phase]?.[draft.suggestionType] ?? 0
      priority += phaseBoost

      if (escalationMode && ESCALATION_PRIORITY_TYPES.has(draft.suggestionType)) priority += 8
      if (escalationMode && LOW_VALUE_DURING_ESCALATION.has(draft.suggestionType)) priority -= 20
      if (strategy.pacing.pacingLabel === "operator_heavy" && draft.suggestionType === "operator_pacing_alert") {
        priority += 10
      }
      if (strategy.discoveryCompleteness.score < 40 && draft.suggestionType === "qualification_gap") {
        priority += 8
      }
      if (strategy.closeReadiness.ready && draft.suggestionType === "close_timing_suggestion") {
        priority += 6
      }

      return { ...draft, priority: Math.max(0, Math.min(100, priority)) }
    })
    .filter((draft) => {
      if (escalationMode && LOW_VALUE_DURING_ESCALATION.has(draft.suggestionType)) return false
      if (overload && draft.priority < VOICE_DEEP_COPILOT_LOW_PRIORITY_SUPPRESSION_SCORE) return false
      return true
    })
    .sort((a, b) => b.priority - a.priority)

  const maxSlots = escalationMode
    ? Math.min(VOICE_DEEP_COPILOT_MAX_ACTIVE_SUGGESTIONS, 4)
    : VOICE_DEEP_COPILOT_MAX_ACTIVE_SUGGESTIONS

  return weighted.slice(0, maxSlots)
}

export function isOperatorOverloadActive(activeAssistEventCount: number): boolean {
  return activeAssistEventCount >= VOICE_DEEP_COPILOT_OVERLOAD_ASSIST_THRESHOLD
}
