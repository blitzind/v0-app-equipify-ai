/** Resolve the single best live phrase for the operator to say next (client-safe). */

import type { ConversationCoachTurn } from "@/lib/growth/live-coaching/types"
import type { UnifiedOperatorAssistSnapshot } from "@/lib/growth/operator-assist/types"
import {
  CONVERSATION_STAGE_LABELS,
  GROWTH_LIVE_COACHING_V2_QA_MARKER,
} from "@/lib/growth/live-coaching/types"

export const GROWTH_SAY_THIS_NEXT_QA_MARKER = "growth-say-this-next-v2" as const

const MAX_SAY_THIS_NEXT_CHARS = 160

function trimPhrase(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const normalized = value.replace(/\s+/g, " ").trim()
  if (normalized.length <= MAX_SAY_THIS_NEXT_CHARS) return normalized
  const cut = normalized.slice(0, MAX_SAY_THIS_NEXT_CHARS - 1)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

function preferRecommendation(event: {
  recommendation: string | null
  operatorPrompt: string
}): string | null {
  return trimPhrase(event.recommendation) ?? trimPhrase(event.operatorPrompt)
}

export type SayThisNextSnapshot = {
  phrase: string
  contextLabel: string
  rationale: string | null
  stageLabel: string | null
  stageObjective: string | null
  source: string
  confidenceScore: number | null
  updatedAt: string
  eventId: string | null
  qaMarker: typeof GROWTH_LIVE_COACHING_V2_QA_MARKER
}

function coachUpdatedAt(coach: ConversationCoachTurn | null | undefined): number {
  if (!coach?.updatedAt) return 0
  const parsed = Date.parse(coach.updatedAt)
  return Number.isFinite(parsed) ? parsed : 0
}

function pickPrimaryCoachTurn(input: {
  serverCoach: ConversationCoachTurn | null | undefined
  optimisticCoach: ConversationCoachTurn | null | undefined
}): ConversationCoachTurn | null {
  const serverCoach = input.serverCoach ?? null
  const optimisticCoach = input.optimisticCoach ?? null
  if (!serverCoach) return optimisticCoach
  if (!optimisticCoach) return serverCoach
  return coachUpdatedAt(serverCoach) >= coachUpdatedAt(optimisticCoach) ? serverCoach : optimisticCoach
}

/** Keep the freshest primaryCoach when browser sync returns a stale operatorAssist shell. */
export function mergeOperatorAssistPreferringNewerCoach(
  previous: UnifiedOperatorAssistSnapshot | null,
  incoming: UnifiedOperatorAssistSnapshot,
): UnifiedOperatorAssistSnapshot {
  if (!previous?.coachingState?.primaryCoach || !incoming.coachingState?.primaryCoach) {
    return incoming
  }
  const prevCoach = previous.coachingState.primaryCoach
  const nextCoach = incoming.coachingState.primaryCoach
  if (coachUpdatedAt(nextCoach) >= coachUpdatedAt(prevCoach)) {
    return incoming
  }
  return {
    ...incoming,
    coachingState: {
      ...incoming.coachingState,
      primaryCoach: prevCoach,
      suggestedNextQuestion: prevCoach.primaryPhrase,
      conversationStage: prevCoach.stage,
      stageObjective: prevCoach.stageObjective,
    },
  }
}

export function resolveSayThisNext(
  operatorAssist: UnifiedOperatorAssistSnapshot | null,
  optimisticCoach?: ConversationCoachTurn | null,
): SayThisNextSnapshot | null {
  if (!operatorAssist && !optimisticCoach) return null

  const generatedAt = operatorAssist?.generatedAt ?? new Date().toISOString()
  const coachingState = operatorAssist?.coachingState ?? null
  const primaryCoach = pickPrimaryCoachTurn({
    serverCoach: coachingState?.primaryCoach,
    optimisticCoach,
  })

  if (primaryCoach?.primaryPhrase) {
    const phrase = trimPhrase(primaryCoach.primaryPhrase)
    if (phrase) {
      return {
        phrase,
        contextLabel: CONVERSATION_STAGE_LABELS[primaryCoach.stage],
        rationale: primaryCoach.rationale,
        stageLabel: CONVERSATION_STAGE_LABELS[primaryCoach.stage],
        stageObjective: primaryCoach.stageObjective,
        source: primaryCoach.source,
        confidenceScore: primaryCoach.confidence,
        updatedAt: primaryCoach.updatedAt,
        eventId: null,
        qaMarker: GROWTH_LIVE_COACHING_V2_QA_MARKER,
      }
    }
  }

  if (!operatorAssist) return null

  const nba = operatorAssist.nextBestAction.primary
  if (nba?.prompt) {
    const phrase = trimPhrase(nba.prompt)
    if (phrase) {
      return {
        phrase,
        contextLabel: nba.title,
        rationale: nba.evidenceText,
        stageLabel: coachingState?.conversationStage
          ? CONVERSATION_STAGE_LABELS[coachingState.conversationStage]
          : null,
        stageObjective: coachingState?.stageObjective ?? null,
        source: nba.source,
        confidenceScore: nba.confidenceScore,
        updatedAt: generatedAt,
        eventId: null,
        qaMarker: GROWTH_LIVE_COACHING_V2_QA_MARKER,
      }
    }
  }

  if (coachingState?.suggestedNextQuestion) {
    const phrase = trimPhrase(coachingState.suggestedNextQuestion)
    if (phrase) {
      return {
        phrase,
        contextLabel: coachingState.conversationStage
          ? CONVERSATION_STAGE_LABELS[coachingState.conversationStage]
          : "Live coaching",
        rationale: coachingState.stageObjective,
        stageLabel: coachingState.conversationStage
          ? CONVERSATION_STAGE_LABELS[coachingState.conversationStage]
          : null,
        stageObjective: coachingState.stageObjective,
        source: "growth_coaching",
        confidenceScore: 0.72,
        updatedAt: generatedAt,
        eventId: null,
        qaMarker: GROWTH_LIVE_COACHING_V2_QA_MARKER,
      }
    }
  }

  const topEvent = operatorAssist.topPriority[0] ?? operatorAssist.feed[0] ?? null
  if (topEvent) {
    const phrase = preferRecommendation(topEvent)
    if (phrase) {
      return {
        phrase,
        contextLabel: topEvent.title,
        rationale: topEvent.evidenceText,
        stageLabel: null,
        stageObjective: null,
        source: topEvent.source,
        confidenceScore: topEvent.confidenceScore,
        updatedAt: topEvent.surfacedAt,
        eventId: topEvent.id,
        qaMarker: GROWTH_LIVE_COACHING_V2_QA_MARKER,
      }
    }
  }

  return null
}
