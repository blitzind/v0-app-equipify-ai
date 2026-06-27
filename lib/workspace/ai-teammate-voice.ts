/**
 * GE-AI-UX-3A — AI Teammate product voice helpers (client-safe).
 */

import {
  AI_TEAMMATE_DEFAULT_NAME,
  resolveAiTeammatePresentation,
  type AiTeammatePresentation,
} from "@/lib/workspace/ai-teammate-identity"

export function teammateHomeIntro(teammate: AiTeammatePresentation): string {
  return `${teammate.name} handled most of the work while you were away.`
}

export function teammateHandledRest(teammate: AiTeammatePresentation): string {
  return `Nothing needs your review right now — ${teammate.name} handled the rest.`
}

export function teammateExceptionSummary(teammate: AiTeammatePresentation, count: number): string {
  if (count <= 0) return teammateHandledRest(teammate)
  const noun = count === 1 ? "item" : "items"
  const verb = count === 1 ? "needs" : "need"
  return `${teammate.subjectPronoun} only needs your approval on ${count} ${noun}.`
}

/** Prefix outcome action lines with teammate pronoun — "Researched 46 companies." → "She researched 46 companies." */
export function teammateAttributeOutcomes(
  teammate: AiTeammatePresentation,
  actionLines: string[],
): string[] {
  return actionLines.map((line) => {
    if (line.startsWith(`${teammate.name} `)) return line
    const lower = line.charAt(0).toLowerCase() + line.slice(1)
    return `${teammate.subjectPronoun} ${lower}`
  })
}

export function teammatePresenceLabel(
  teammate: AiTeammatePresentation,
  activity: string,
): string {
  const trimmed = activity.trim()
  if (!trimmed) return `${teammate.name} is working`
  const lowerFirst = trimmed.charAt(0).toLowerCase() + trimmed.slice(1)
  return `${teammate.name} is ${lowerFirst}`
}

export function teammateWaitingForApproval(teammate: AiTeammatePresentation): string {
  return `${teammate.name} is waiting for your approval`
}

export function teammatePreparedSummary(teammate: AiTeammatePresentation, count: number, noun: string): string {
  const plural = count === 1 ? noun : `${noun}s`
  return `${count} ${plural} ${teammate.name} prepared but cannot complete alone.`
}

export function teammateActivitySummary(
  teammate: AiTeammatePresentation,
  verbPhrase: string,
): string {
  return `${teammate.name} is ${verbPhrase}`
}

export function teammateTimelineAction(teammate: AiTeammatePresentation, action: string): string {
  const lower = action.charAt(0).toLowerCase() + action.slice(1)
  return `${teammate.name} ${lower}`
}

export function teammateHealthHandledLabel(teammate: AiTeammatePresentation): string {
  return `${teammate.name} handled most of the work`
}

export function teammateIdleMonitoring(teammate: AiTeammatePresentation): string {
  return `${teammate.name} is monitoring your market and inbox for the next opportunity.`
}

export function teammateWorkInProgressSubtitle(teammate: AiTeammatePresentation): string {
  return `Work ${teammate.name} is handling while you focus on exceptions.`
}

export function teammateImprovementsSubtitle(teammate: AiTeammatePresentation): string {
  return `How ${teammate.name} is getting smarter from your recent outcomes.`
}

export function defaultTeammatePresentation(): AiTeammatePresentation {
  return resolveAiTeammatePresentation(AI_TEAMMATE_DEFAULT_NAME)
}
