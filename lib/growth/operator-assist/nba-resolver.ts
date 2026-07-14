/** Unified next-best-action resolver — one primary recommendation, evidence ranked. */

import { pickSuggestedNextQuestion } from "@/lib/growth/live-guidance/live-guidance-engine"
import type { GrowthLiveCoachingState } from "@/lib/growth/live-guidance/live-guidance-types"
import type { GrowthRealtimeLiveSnapshot } from "@/lib/growth/realtime/realtime-call-types"
import type { NativeDialerLeadContext } from "@/lib/growth/native-dialer/native-dialer-types"
import type { VoiceCallConversationIntelligenceSnapshot } from "@/lib/voice/intelligence/types"
import type {
  UnifiedNextBestActionItem,
  UnifiedNextBestActionSnapshot,
  UnifiedOperatorAssistEvent,
} from "@/lib/growth/operator-assist/types"
import type { CallWorkspaceAiosLiveReasoningSnapshot } from "@/lib/growth/operator-assist/call-workspace-aios-live-reasoning-types"

function toNbaItem(input: {
  title: string
  prompt: string
  evidenceText: string
  confidenceScore: number
  source: string
  dedupeKey: string
}): UnifiedNextBestActionItem {
  return {
    title: input.title,
    prompt: input.prompt,
    evidenceText: input.evidenceText,
    confidenceScore: input.confidenceScore,
    source: input.source,
    dedupeKey: input.dedupeKey,
  }
}

export function resolveUnifiedNextBestAction(input: {
  coachingState: GrowthLiveCoachingState | null
  liveSnapshot: GrowthRealtimeLiveSnapshot | null
  conversationIntelligence: VoiceCallConversationIntelligenceSnapshot | null
  leadContext: Pick<NativeDialerLeadContext, "recommendedNextAction"> | null
  rankedAssistEvents: UnifiedOperatorAssistEvent[]
  aiosLiveReasoning?: CallWorkspaceAiosLiveReasoningSnapshot | null
}): UnifiedNextBestActionSnapshot {
  const candidates: UnifiedNextBestActionItem[] = []

  if (input.aiosLiveReasoning?.sayThisNext.recommendedNextSentence) {
    const say = input.aiosLiveReasoning.sayThisNext
    candidates.push(
      toNbaItem({
        title: "Exactly what to say next",
        prompt: say.recommendedNextSentence,
        evidenceText: say.why,
        confidenceScore: say.confidence,
        source: "aios_live_reasoning",
        dedupeKey: `aios-say-this-next:${input.aiosLiveReasoning.triggeredBySequenceNumber ?? "bootstrap"}`,
      }),
    )
  }

  if (!input.aiosLiveReasoning && input.coachingState?.primaryCoach?.primaryPhrase) {
    const coach = input.coachingState.primaryCoach
    candidates.push(
      toNbaItem({
        title: "Live coach",
        prompt: coach.primaryPhrase,
        evidenceText: coach.rationale,
        confidenceScore: coach.confidence,
        source: coach.source,
        dedupeKey: `primary-coach:${coach.triggeredBySequenceNumber ?? "bootstrap"}`,
      }),
    )
  }

  const voiceNba = !input.aiosLiveReasoning ? input.conversationIntelligence?.suggestedNextBestAction : null
  if (voiceNba) {
    candidates.push(
      toNbaItem({
        title: "Voice intelligence recommendation",
        prompt: voiceNba.suggestedOperatorAction,
        evidenceText: voiceNba.evidenceText,
        confidenceScore: voiceNba.confidenceScore,
        source: "voice_intelligence",
        dedupeKey: `voice-nba:${voiceNba.eventType}:${voiceNba.evidenceText.slice(0, 80)}`,
      }),
    )
  }

  if (!input.aiosLiveReasoning && input.coachingState?.suggestedNextQuestion && !input.coachingState.primaryCoach) {
    candidates.push(
      toNbaItem({
        title: "Suggested discovery question",
        prompt: input.coachingState.suggestedNextQuestion,
        evidenceText: "Derived from live coaching discovery coverage.",
        confidenceScore: 0.72,
        source: "growth_coaching",
        dedupeKey: `coaching-question:${input.coachingState.suggestedNextQuestion.slice(0, 80)}`,
      }),
    )
  }

  if (!input.aiosLiveReasoning && input.liveSnapshot) {
    const picked = pickSuggestedNextQuestion({
      snapshot: input.liveSnapshot,
      candidates: [],
    })
    if (picked) {
      candidates.push(
        toNbaItem({
          title: "Live coaching follow-up",
          prompt: picked,
          evidenceText: "Based on current live coaching snapshot.",
          confidenceScore: 0.68,
          source: "growth_coaching_engine",
          dedupeKey: `engine-question:${picked.slice(0, 80)}`,
        }),
      )
    }
  }

  for (const event of input.rankedAssistEvents.slice(0, 4)) {
    if (!event.recommendation && !event.operatorPrompt) continue
    candidates.push(
      toNbaItem({
        title: event.title,
        prompt: event.recommendation || event.operatorPrompt,
        evidenceText: event.evidenceText,
        confidenceScore: event.confidenceScore,
        source: event.source,
        dedupeKey: `assist:${event.dedupeKey}`,
      }),
    )
  }

  if (input.leadContext?.recommendedNextAction) {
    candidates.push(
      toNbaItem({
        title: "Lead workflow recommendation",
        prompt: input.leadContext.recommendedNextAction,
        evidenceText: "From linked lead context — not live transcript evidence.",
        confidenceScore: 0.55,
        source: "lead_context",
        dedupeKey: `lead:${input.leadContext.recommendedNextAction.slice(0, 80)}`,
      }),
    )
  }

  const deduped = new Map<string, UnifiedNextBestActionItem>()
  for (const candidate of candidates) {
    if (!deduped.has(candidate.dedupeKey)) deduped.set(candidate.dedupeKey, candidate)
  }

  const ranked = [...deduped.values()].sort((a, b) => b.confidenceScore - a.confidenceScore)
  const [primary, ...supporting] = ranked

  return {
    primary: primary ?? null,
    supporting: supporting.slice(0, 3),
  }
}
