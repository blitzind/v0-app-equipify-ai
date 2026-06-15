/** Phase GS-1E — Unified Operator Inbox types (client-safe). */

export const OPERATOR_INBOX_QA_MARKER = "growth-operator-inbox-gs1e-v1" as const

export const OPERATOR_INBOX_CONFIRM = "RUN_OPERATOR_INBOX_CERTIFICATION" as const

export const OPERATOR_INBOX_ITEM_SOURCES = [
  "signal",
  "reply_workflow",
  "attention",
  "human_approval",
  "inbox_thread",
  "recommended_action",
] as const

export type OperatorInboxItemSource = (typeof OPERATOR_INBOX_ITEM_SOURCES)[number]

export const OPERATOR_INBOX_PRIORITIES = ["low", "medium", "high", "urgent"] as const
export type OperatorInboxPriority = (typeof OPERATOR_INBOX_PRIORITIES)[number]

export const OPERATOR_INBOX_FILTERS = [
  "all",
  "urgent",
  "signals",
  "replies",
  "approvals",
  "attention",
  "threads",
] as const

export type OperatorInboxFilter = (typeof OPERATOR_INBOX_FILTERS)[number]

export const OPERATOR_INBOX_ACTIONS = ["mark_viewed", "mark_reviewed", "dismiss"] as const
export type OperatorInboxActionType = (typeof OPERATOR_INBOX_ACTIONS)[number]

export type OperatorInboxItem = {
  qa_marker: typeof OPERATOR_INBOX_QA_MARKER
  item_id: string
  source: OperatorInboxItemSource
  source_ref: string
  title: string
  description: string
  reasoning: string[]
  priority: OperatorInboxPriority
  confidence: number
  lead_id: string | null
  company_name: string | null
  occurred_at: string
  cta_href: string | null
  status: "new" | "viewed" | "reviewed" | "dismissed"
  requires_human_review: true
  autonomous_execution_enabled: false
}

export type OperatorInboxSourceCounts = {
  signal: number
  reply_workflow: number
  attention: number
  human_approval: number
  inbox_thread: number
  recommended_action: number
}

export type OperatorInboxQueueResponse = {
  qa_marker: typeof OPERATOR_INBOX_QA_MARKER
  generated_at: string
  total: number
  urgent_count: number
  source_counts: OperatorInboxSourceCounts
  items: OperatorInboxItem[]
  requires_human_review: true
  autonomous_execution_enabled: false
}

export type OperatorInboxActionRequest = {
  action: OperatorInboxActionType
  item_id: string
  source: OperatorInboxItemSource
  source_ref: string
}

export const OPERATOR_INBOX_SOURCE_LABELS: Record<OperatorInboxItemSource, string> = {
  signal: "Signal",
  reply_workflow: "Reply workflow",
  attention: "Attention",
  human_approval: "Human approval",
  inbox_thread: "Inbox thread",
  recommended_action: "Recommended action",
}
