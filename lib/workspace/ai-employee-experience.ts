/**
 * GE-AI-UX-4A — AI Employee experience terminology and status (client-safe).
 */

export const GE_AI_UX_4A_QA_MARKER = "ge-ai-ux-4a-ai-employee-experience-v1" as const

export const AI_EMPLOYEE_CHECK_IN_AWAY_INTRO = "While you were away I:" as const
export const AI_EMPLOYEE_CHECK_IN_FOCUS_INTRO = "Today I'm focusing on:" as const
export const AI_EMPLOYEE_WORKING_ON_TITLE = "What I'm Working On" as const
export const AI_EMPLOYEE_COMPLETED_TODAY_TITLE = "Completed Today" as const
export const AI_EMPLOYEE_NEEDS_REVIEW_TITLE = "Needs Your Review" as const
export const AI_EMPLOYEE_WORK_SUMMARY_TITLE = "Everything I Accomplished" as const

export const AI_EMPLOYEE_REVIEW_BUCKETS = {
  readyToSend: "Ready to send",
  readyToActivate: "Ready to activate",
  needsYourDecision: "Needs your decision",
  waitingOnApproval: "Waiting on approval",
  blocked: "Blocked",
} as const

export const AI_EMPLOYEE_WORK_SUMMARY_CATEGORIES = [
  { id: "prospecting", label: "Prospecting" },
  { id: "campaigns", label: "Campaigns" },
  { id: "meetings", label: "Meetings" },
  { id: "revenue", label: "Revenue" },
  { id: "learning", label: "Learning" },
  { id: "monitoring", label: "Monitoring" },
] as const

export type AiEmployeeStatusKind =
  | "working"
  | "researching"
  | "preparing_outreach"
  | "monitoring_replies"
  | "learning"
  | "waiting_for_approval"
  | "idle"

export type AiEmployeeStatus = {
  kind: AiEmployeeStatusKind
  label: string
}

export function employeeFirstPerson(action: string): string {
  const trimmed = action.trim().replace(/\.$/, "")
  if (trimmed.toLowerCase().startsWith("i ")) return trimmed
  const lower = trimmed.charAt(0).toLowerCase() + trimmed.slice(1)
  return `I ${lower}`
}

export function employeeNeedsHelpLine(count: number): string {
  if (count <= 0) return "I don't need anything from you right now."
  const noun = count === 1 ? "approval" : "approvals"
  return `I only need your help with ${count} ${noun}.`
}

export function employeeOutcomeCheckInLine(action: string): string {
  return action
    .replace(/^(She|He|They) /i, "")
    .replace(/^Is /i, "")
    .replace(/\.$/, "")
}
