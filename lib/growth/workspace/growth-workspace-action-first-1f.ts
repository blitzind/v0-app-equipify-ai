/**
 * GROWTH-WORKSPACE-ACTION-FIRST-1F / GE-AIOS-IDENTITY-1B — action-before-metrics operator UX copy.
 */

import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import {
  needsApproval,
  nothingNeededFromYou,
  recommends,
  whatTeammateNoticed,
  workInProgressTitle,
} from "@/lib/workspace/ai-teammate-voice"

export const GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER = "growth-workspace-action-first-1f-v1" as const

export function growthActionFirstRecommends(teammate: AiTeammatePresentation): string {
  return recommends(teammate)
}

export function growthActionFirstNoticed(teammate: AiTeammatePresentation): string {
  return whatTeammateNoticed(teammate)
}

export function growthActionFirstPrepared(teammate: AiTeammatePresentation): string {
  return `${teammate.name} prepared`
}

export function growthActionFirstWaiting(teammate: AiTeammatePresentation): string {
  return needsApproval(teammate)
}

export const GROWTH_ACTION_FIRST_CAUGHT_UP_TITLE = "You're all caught up." as const

export function growthActionFirstIdle(teammate: AiTeammatePresentation): string {
  return nothingNeededFromYou(teammate)
}

export const GROWTH_ACTION_FIRST_DASHBOARD_PRIORITIES = "Today's priorities" as const

export function growthActionFirstDashboardHandling(teammate: AiTeammatePresentation): string {
  return workInProgressTitle(teammate)
}

export const GROWTH_ACTION_FIRST_LEADS_PRIORITY = "Today's priority leads" as const
export const GROWTH_ACTION_FIRST_INBOX_REPLIES_WAITING = "Replies waiting" as const
export const GROWTH_ACTION_FIRST_INBOX_NEEDS_REVIEW = "Needs review" as const
export const GROWTH_ACTION_FIRST_INBOX_HIGH_PRIORITY = "High-priority conversations" as const
export const GROWTH_ACTION_FIRST_CALLS_WHO = "Who should I call?" as const
export const GROWTH_ACTION_FIRST_CALLS_WHY = "Why call now" as const
export const GROWTH_ACTION_FIRST_CALLS_OUTCOME = "Expected outcome" as const
export const GROWTH_ACTION_FIRST_CALLS_READINESS = "Call readiness" as const
export const GROWTH_ACTION_FIRST_MEETINGS_TODAY = "Today's meetings" as const
export const GROWTH_ACTION_FIRST_MEETINGS_PREP = "Preparation needed" as const
export const GROWTH_ACTION_FIRST_MEETINGS_FOLLOW_UP = "Follow-up required" as const
export const GROWTH_ACTION_FIRST_CONVERSATIONS_NEEDS_RESPONSE = "Needs response" as const
export const GROWTH_ACTION_FIRST_CONVERSATIONS_NEEDS_REVIEW = "Needs review" as const
export const GROWTH_ACTION_FIRST_CONVERSATIONS_HEALTH = "Conversation health" as const
export const GROWTH_ACTION_FIRST_RELATIONSHIPS_AT_RISK = "Relationships at risk" as const
export const GROWTH_ACTION_FIRST_RELATIONSHIPS_COMMITTEE = "Buying committee changes" as const
export const GROWTH_ACTION_FIRST_RELATIONSHIPS_ENGAGEMENT = "Recent engagement" as const
export const GROWTH_ACTION_FIRST_SUPPORTING_METRICS = "Supporting metrics" as const

export const GROWTH_ACTION_FIRST_1F_SURFACES = [
  "lib/growth/workspace/growth-workspace-action-first-1f.ts",
  "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
] as const
