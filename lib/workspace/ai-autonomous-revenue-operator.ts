/**
 * GE-AI-8A — Autonomous Revenue Operator terminology (client-safe).
 */

export const GE_AI_8A_QA_MARKER = "ge-ai-8a-autonomous-revenue-operator-v1" as const

export const AI_REVENUE_ACTIVE_MISSIONS_TITLE = "My Active Revenue Missions" as const
export const AI_REVENUE_MISSION_TIMELINE_TITLE = "Revenue Mission Timeline" as const
export const AI_REVENUE_NEXT_PLANNED_ACTIONS_TITLE = "Next Planned Actions" as const
export const AI_REVENUE_FORECAST_TITLE = "Revenue Forecast" as const
export const AI_REVENUE_MISSION_HEALTH_TITLE = "Mission Health" as const

export const AI_REVENUE_MISSION_LIFECYCLE_STAGES = [
  "Research",
  "Qualification",
  "Planning",
  "Communication",
  "Approval",
  "Outbound",
  "Replies",
  "Meetings",
  "Opportunities",
  "Won",
] as const

export type AiRevenueMissionLifecycleStage = (typeof AI_REVENUE_MISSION_LIFECYCLE_STAGES)[number]

export const AI_REVENUE_MISSION_HEALTH_LABELS = {
  healthy: "Healthy",
  waiting: "Waiting",
  blocked: "Blocked",
  needs_review: "Needs Review",
  completed: "Completed",
} as const

export type AiRevenueMissionHealthState = keyof typeof AI_REVENUE_MISSION_HEALTH_LABELS

export const AI_REVENUE_MISSION_CONTROLS = {
  pause: "Pause mission",
  resume: "Resume mission",
  review: "Review mission",
  open_approvals: "Open approvals",
} as const

export type AiRevenueMissionControlKind = keyof typeof AI_REVENUE_MISSION_CONTROLS

export const AI_REVENUE_OPERATOR_FORBIDDEN_CONTROLS = [
  "Send now",
  "Override policy",
  "Skip approval",
] as const

export function operatorMissionSummary(activeCount: number): string | null {
  if (activeCount <= 0) return null
  const noun = activeCount === 1 ? "mission" : "missions"
  return `I'm driving ${activeCount} active revenue ${noun}.`
}
