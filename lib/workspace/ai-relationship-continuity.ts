/**
 * GE-AI-UX-7A — AI relationship & continuity terminology (client-safe).
 */

export const GE_AI_UX_7A_QA_MARKER = "ge-ai-ux-7a-ai-relationship-continuity-v1" as const

export const AI_CONTINUITY_SINCE_LAST_CHECK_IN = "Since we last checked in..." as const
export const AI_CONTINUITY_SINCE_WE_LAST_MET_TITLE = "Since We Last Met" as const
export const AI_CONTINUITY_WHAT_CHANGED_TITLE = "What Changed" as const
export const AI_CONTINUITY_OUR_PROGRESS_TITLE = "Our Progress" as const
export const AI_CONTINUITY_MILESTONES_TITLE = "Milestones" as const
export const AI_CONTINUITY_TRUST_TITLE = "Trust & Confidence" as const
export const AI_CONTINUITY_RECOMMENDATION_CONTINUITY_TITLE = "Recommendation Continuity" as const

export const AI_CONTINUITY_DAILY_BRIEFING = {
  morning: "Here's what changed overnight.",
  afternoon: "Here's what still needs attention today.",
  evening: "Here's what we accomplished today.",
} as const

export type AiContinuityDailyPeriod = keyof typeof AI_CONTINUITY_DAILY_BRIEFING

export function deriveDailyBriefingPeriod(hour: number): AiContinuityDailyPeriod {
  if (hour < 12) return "morning"
  if (hour < 17) return "afternoon"
  return "evening"
}

export function relationshipTimePhrase(isoDate: string, nowIso: string): string {
  const then = new Date(isoDate).getTime()
  const now = new Date(nowIso).getTime()
  const hours = (now - then) / (1000 * 60 * 60)
  if (hours < 6) return "Earlier today"
  if (hours < 30) return "Yesterday"
  if (hours < 24 * 8) return "Last week"
  return "Since we last met"
}

export function hoursSince(isoDate: string, nowIso: string): number {
  return (new Date(nowIso).getTime() - new Date(isoDate).getTime()) / (1000 * 60 * 60)
}
