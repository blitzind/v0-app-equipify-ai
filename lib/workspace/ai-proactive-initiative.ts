/**
 * GE-AI-UX-5A — Proactive AI initiative terminology (client-safe).
 */

export const GE_AI_UX_5A_QA_MARKER = "ge-ai-ux-5a-proactive-ai-initiative-v1" as const

export const AI_PROACTIVE_FOUND_INTRO = "Here's what I found since your last visit." as const
export const AI_PROACTIVE_THINGS_NOTICED_TITLE = "Things I Noticed" as const
export const AI_PROACTIVE_WATCHING_TITLE = "What I'm Watching" as const
export const AI_PROACTIVE_RECOMMENDATIONS_TITLE = "What I Recommend" as const

export const AI_INITIATIVE_CONFIDENCE_LABELS = {
  high: "High confidence",
  medium: "Medium confidence",
  needs_more_evidence: "Needs more evidence",
} as const

export const AI_INITIATIVE_PRIORITY_LABELS = {
  handle_today: "Handle Today",
  worth_reviewing: "Worth Reviewing",
  keep_an_eye_on: "Keep An Eye On",
  can_wait: "Can Wait",
} as const

export const AI_INITIATIVE_RECOMMENDATION_CATEGORIES = [
  { id: "opportunities", label: "Opportunities" },
  { id: "risks", label: "Risks" },
  { id: "follow_up", label: "Follow-up" },
  { id: "revenue", label: "Revenue" },
  { id: "campaigns", label: "Campaigns" },
  { id: "meetings", label: "Meetings" },
  { id: "learning", label: "Learning" },
] as const

export type AiInitiativeConfidence = keyof typeof AI_INITIATIVE_CONFIDENCE_LABELS
export type AiInitiativePriority = keyof typeof AI_INITIATIVE_PRIORITY_LABELS
export type AiInitiativeRecommendationCategory = (typeof AI_INITIATIVE_RECOMMENDATION_CATEGORIES)[number]["id"]

export function initiativeConfidenceLabel(confidence: AiInitiativeConfidence): string {
  return AI_INITIATIVE_CONFIDENCE_LABELS[confidence]
}

export function initiativePriorityLabel(priority: AiInitiativePriority): string {
  return AI_INITIATIVE_PRIORITY_LABELS[priority]
}

export function deriveInitiativeConfidence(input: {
  impactScore?: number
  hasMetricEvidence?: boolean
  priorityRank?: number
}): AiInitiativeConfidence {
  const score = input.impactScore ?? 0
  if (score >= 80 && input.hasMetricEvidence !== false) return "high"
  if (score >= 50 || input.priorityRank === 1) return "medium"
  return "needs_more_evidence"
}

export function deriveInitiativePriority(input: {
  impactScore?: number
  priorityRank?: number
  urgent?: boolean
}): AiInitiativePriority {
  if (input.urgent || input.priorityRank === 1 || (input.impactScore ?? 0) >= 85) return "handle_today"
  if (input.priorityRank === 2 || (input.impactScore ?? 0) >= 65) return "worth_reviewing"
  if ((input.impactScore ?? 0) >= 40) return "keep_an_eye_on"
  return "can_wait"
}

export function initiativeObservationPrefix(kind: "found" | "noticed" | "discovered" | "detected" | "identified" | "recommend"): string {
  const map = {
    found: "I found",
    noticed: "I noticed",
    discovered: "I discovered",
    detected: "I detected",
    identified: "I identified",
    recommend: "I recommend",
  }
  return map[kind]
}

export function proactiveCalmLine(urgentCount: number): string | null {
  if (urgentCount > 0) return null
  return "Nothing urgent requires your attention today."
}

export function recommendBecause(headline: string, reason: string): string {
  const trimmedReason = reason.trim().replace(/\.$/, "")
  const lowerHeadline = headline.charAt(0).toLowerCase() + headline.slice(1)
  if (lowerHeadline.startsWith("i recommend")) return `${headline} because ${trimmedReason}.`
  return `I recommend ${lowerHeadline} because ${trimmedReason}.`
}
