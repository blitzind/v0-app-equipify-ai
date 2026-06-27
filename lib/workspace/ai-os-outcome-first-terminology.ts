/**
 * GE-AI-UX-2A — Outcome-first operator terminology (UI only).
 * Internal code identifiers, APIs, and Advanced diagnostics keep engineering names.
 */

export const GE_AI_UX_2A_QA_MARKER = "ge-ai-ux-2a-outcome-first-unified-experience-v1" as const

export const AI_OS_OUTCOME_FIRST_HOME_INTRO =
  "Since your last visit, AI handled most of the work." as const

export const AI_OS_EXCEPTIONS_SECTION_TITLE = "Exceptions" as const
export const AI_OS_EXCEPTIONS_SECTION_SUBTITLE =
  "AI completed everything else — these items need your judgment." as const

export const AI_OS_APPROVALS_SECTION_TITLE = "Exceptions & Approvals" as const
export const AI_OS_APPROVALS_SECTION_SUBTITLE =
  "Review the few items AI cannot safely complete alone." as const

export const AI_OS_TOP_BUSINESS_MOVE_TITLE = "Top Business Move" as const
export const AI_OS_RECOMMENDED_NEXT_OUTCOME_TITLE = "Recommended Next Outcome" as const

export const AI_OS_OUTREACH_PLAN_TITLE = "Recommended Outreach" as const
export const AI_OS_AI_WORK_IN_PROGRESS_TITLE = "Work AI Is Handling" as const
export const AI_OS_AI_IMPROVEMENTS_TITLE = "AI Improvements" as const

export const AI_OS_HOME_PRIMARY_CTA = "Review Exceptions" as const
export const AI_OS_HOME_SECONDARY_CTA = "View AI Work Summary" as const

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
