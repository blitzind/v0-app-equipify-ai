/** Client-safe Growth Engine inbox team ownership types (Phase 2K). */

export const GROWTH_INBOX_TEAM_OWNERSHIP_QA_MARKER = "growth-inbox-team-ownership-v1" as const

export const GROWTH_INBOX_TEAM_OWNERSHIP_PRIVACY_NOTE =
  "Inbox team ownership requires human action for assignment changes. Suggestions only — auto-assignment disabled by default. No autonomous replies or sends."

export const GROWTH_INBOX_ASSIGNMENT_SOURCES = [
  "manual",
  "claim",
  "handoff",
  "lead_owner",
  "rule_suggestion",
  "manager_override",
] as const
export type GrowthInboxAssignmentSource = (typeof GROWTH_INBOX_ASSIGNMENT_SOURCES)[number]

export const GROWTH_INBOX_OWNER_ACTIONS = ["assigned", "claimed", "handoff", "unassigned"] as const
export type GrowthInboxOwnerAction = (typeof GROWTH_INBOX_OWNER_ACTIONS)[number]

export const GROWTH_INBOX_ASSIGNMENT_RULE_TYPES = [
  "lead_owner",
  "specific_rep",
  "round_robin",
  "classification",
] as const
export type GrowthInboxAssignmentRuleType = (typeof GROWTH_INBOX_ASSIGNMENT_RULE_TYPES)[number]

export const GROWTH_INBOX_TEAM_QUEUE_VIEWS = [
  "my_threads",
  "unassigned",
  "sla_risk",
  "aging_replies",
  "all",
] as const
export type GrowthInboxTeamQueueView = (typeof GROWTH_INBOX_TEAM_QUEUE_VIEWS)[number]

export const GROWTH_INBOX_SLA_STATUSES = ["ok", "at_risk", "overdue"] as const
export type GrowthInboxSlaStatus = (typeof GROWTH_INBOX_SLA_STATUSES)[number]

export const GROWTH_INBOX_OWNERSHIP_TIMELINE_EVENT_TYPES = [
  "thread_claimed",
  "thread_handoff",
  "thread_unassigned",
  "thread_sla_overdue",
  "inbox_assignment_rule_applied",
] as const
export type GrowthInboxOwnershipTimelineEventType = (typeof GROWTH_INBOX_OWNERSHIP_TIMELINE_EVENT_TYPES)[number]

export type GrowthInboxAssignmentSettings = {
  id: string
  autoAssignEnabled: boolean
  slaAlertsEnabled: boolean
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthInboxAssignmentRule = {
  id: string
  enabled: boolean
  priorityOrder: number
  ruleType: GrowthInboxAssignmentRuleType
  classification: string | null
  priorityTier: string | null
  targetUserId: string | null
  targetUserLabel: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type GrowthInboxThreadOwnerHistoryEntry = {
  id: string
  inboxThreadId: string
  action: GrowthInboxOwnerAction
  fromUserLabel: string | null
  toUserLabel: string | null
  handoffNote: string | null
  assignmentSource: string | null
  actorLabel: string
  createdAt: string
}

export type GrowthInboxOwnerSuggestion = {
  suggestedUserId: string
  suggestedUserLabel: string
  ruleType: GrowthInboxAssignmentRuleType | "lead_owner_fallback"
  reasons: string[]
  confidence: number
}

export type GrowthInboxThreadQueueItem = {
  id: string
  leadLabel: string
  subject: string
  threadStatus: string
  priorityTier: string
  classification: string
  ownerLabel: string | null
  lastMessageAt: string | null
  slaDueAt: string | null
  slaStatus: GrowthInboxSlaStatus
  isAging: boolean
  requiresHumanReview: boolean
}

export type GrowthInboxTeamDashboard = {
  qa_marker: typeof GROWTH_INBOX_TEAM_OWNERSHIP_QA_MARKER
  myThreads: GrowthInboxThreadQueueItem[]
  unassigned: GrowthInboxThreadQueueItem[]
  slaRisk: GrowthInboxThreadQueueItem[]
  agingReplies: GrowthInboxThreadQueueItem[]
  counts: {
    myThreads: number
    unassigned: number
    slaRisk: number
    agingReplies: number
  }
  settings: GrowthInboxAssignmentSettings
  rules: GrowthInboxAssignmentRule[]
  reps: Array<{ userId: string; label: string }>
}

export function maskInboxOwnerLabel(userId: string | null, displayName?: string | null, email?: string | null): string {
  if (displayName?.trim()) return displayName.trim().slice(0, 80)
  if (email?.trim()) {
    const local = email.split("@")[0] ?? email
    return local.replace(/[._-]+/g, " ").trim().slice(0, 80) || "Operator"
  }
  if (!userId) return "Unassigned"
  return `Operator ${userId.slice(0, 8)}…`
}

export function inboxAssignmentSourceLabel(source: GrowthInboxAssignmentSource | string | null): string {
  if (!source) return "manual"
  return source.replace(/_/g, " ")
}

export function inboxOwnerActionLabel(action: GrowthInboxOwnerAction): string {
  return action.replace(/_/g, " ")
}

export function inboxTeamQueueViewLabel(view: GrowthInboxTeamQueueView): string {
  switch (view) {
    case "my_threads":
      return "My Threads"
    case "unassigned":
      return "Unassigned"
    case "sla_risk":
      return "SLA Risk"
    case "aging_replies":
      return "Aging Replies"
    default:
      return "All Threads"
  }
}
