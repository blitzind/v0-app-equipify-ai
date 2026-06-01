/** Resolve the single best live phrase for the operator to say next (client-safe). */

import type { UnifiedOperatorAssistSnapshot } from "@/lib/growth/operator-assist/types"

export const GROWTH_SAY_THIS_NEXT_QA_MARKER = "growth-say-this-next-v1" as const

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
  source: string
  confidenceScore: number | null
  updatedAt: string
  eventId: string | null
}

export function resolveSayThisNext(
  operatorAssist: UnifiedOperatorAssistSnapshot | null,
): SayThisNextSnapshot | null {
  if (!operatorAssist) return null

  const coachingState = operatorAssist.coachingState
  const generatedAt = operatorAssist.generatedAt

  const nba = operatorAssist.nextBestAction.primary
  if (nba?.prompt) {
    const phrase = trimPhrase(nba.prompt)
    if (phrase) {
      return {
        phrase,
        contextLabel: nba.title,
        source: nba.source,
        confidenceScore: nba.confidenceScore,
        updatedAt: generatedAt,
        eventId: null,
      }
    }
  }

  if (coachingState?.suggestedNextQuestion) {
    const phrase = trimPhrase(coachingState.suggestedNextQuestion)
    if (phrase) {
      return {
        phrase,
        contextLabel: "Discovery follow-up",
        source: "growth_coaching",
        confidenceScore: 0.72,
        updatedAt: generatedAt,
        eventId: null,
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
        source: topEvent.source,
        confidenceScore: topEvent.confidenceScore,
        updatedAt: topEvent.surfacedAt,
        eventId: topEvent.id,
      }
    }
  }

  return null
}
