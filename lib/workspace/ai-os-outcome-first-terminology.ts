/**
 * GE-AI-UX-2A / GE-AIOS-IDENTITY-1B — Outcome-first operator terminology (UI only).
 * Internal code identifiers, APIs, and Advanced diagnostics keep engineering names.
 */

import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import {
  completedWorkDescription,
  completedWorkTitle,
  exceptionsSubtitle,
  improvementsFromTeammate,
  reviewCompletedWork,
  teammateHomeIntro,
  viewWorkSummary,
  workInProgressTitle,
} from "@/lib/workspace/ai-teammate-voice"

export const GE_AI_UX_2A_QA_MARKER = "ge-ai-ux-2a-outcome-first-unified-experience-v1" as const

export function aiOsOutcomeFirstHomeIntro(teammate: AiTeammatePresentation): string {
  return teammateHomeIntro(teammate)
}

export const AI_OS_EXCEPTIONS_SECTION_TITLE = "Exceptions" as const

export function aiOsExceptionsSectionSubtitle(teammate: AiTeammatePresentation): string {
  return exceptionsSubtitle(teammate)
}

export function aiOsApprovalsSectionTitle(teammate: AiTeammatePresentation): string {
  return completedWorkTitle(teammate)
}

export function aiOsApprovalsSectionSubtitle(teammate: AiTeammatePresentation): string {
  return completedWorkDescription(teammate)
}

export const AI_OS_TOP_BUSINESS_MOVE_TITLE = "Top Business Move" as const
export const AI_OS_RECOMMENDED_NEXT_OUTCOME_TITLE = "Recommended Next Outcome" as const

export const AI_OS_OUTREACH_PLAN_TITLE = "Recommended Outreach" as const

export function aiOsWorkInProgressTitle(teammate: AiTeammatePresentation): string {
  return workInProgressTitle(teammate)
}

export function aiOsImprovementsTitle(teammate: AiTeammatePresentation): string {
  return improvementsFromTeammate(teammate)
}

export function aiOsHomePrimaryCta(teammate: AiTeammatePresentation): string {
  return reviewCompletedWork(teammate)
}

export function aiOsHomeSecondaryCta(teammate: AiTeammatePresentation): string {
  return viewWorkSummary(teammate)
}

/** Outcome buckets for approval grouping (default operator UI). */
export const AI_OS_APPROVAL_OUTCOME_BUCKETS = {
  readyToSend: "Ready to send",
  readyToActivate: "Ready to activate",
  readyToApply: "Ready to apply",
  needsReview: "Needs review",
  blocked: "Blocked",
} as const

/** Default operator activity groups — outcome language. */
export const AI_OS_OUTCOME_ACTIVITY_GROUPS = [
  "Finding opportunities",
  "Preparing outreach",
  "Booking meetings",
  "Advancing deals",
  "Learning what works",
  "Monitoring risk",
] as const

/** Engineering labels that must not appear in default Home / operator chrome. */
export const AI_OS_HIDDEN_DEFAULT_ENGINE_LABELS = [
  "Revenue Director",
  "Communication Engine",
  "Meta-Recommender",
  "Priority Engine",
  "Human Approval Center",
  "Approval Center",
  "Calibration",
  "workflow request",
  "priority binding",
  "meta recommendation",
  "dispatcher",
  "subscriber",
  "adapter",
] as const

/** Recommended nav for UX-2B — not applied in UX-2A (routes unchanged). */
export const AI_OS_UX_2B_RECOMMENDED_NAV = [
  "Home",
  "Prospecting",
  "Campaigns",
  "Conversations",
  "Meetings",
  "Objectives",
  "Runbooks",
  "Settings",
  "Advanced",
] as const
