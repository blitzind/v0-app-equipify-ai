/** Growth Engine — Unified Inbox types (Phase 2B). Client-safe. */

export const GROWTH_UNIFIED_INBOX_FOUNDATION_QA_MARKER = "growth-unified-inbox-foundation-v1" as const

export const GROWTH_INBOX_THREAD_STATUSES = ["open", "waiting", "needs_review", "resolved", "archived"] as const
export type GrowthInboxThreadStatus = (typeof GROWTH_INBOX_THREAD_STATUSES)[number]

export const GROWTH_INBOX_PRIORITY_TIERS = ["low", "normal", "high", "critical"] as const
export type GrowthInboxPriorityTier = (typeof GROWTH_INBOX_PRIORITY_TIERS)[number]

export const GROWTH_INBOX_CLASSIFICATIONS = [
  "unknown",
  "positive_interest",
  "question",
  "budget",
  "timeline",
  "competitor",
  "not_interested",
  "unsubscribe",
  "meeting_intent",
  "referral",
] as const
export type GrowthInboxClassification = (typeof GROWTH_INBOX_CLASSIFICATIONS)[number]

export const GROWTH_INBOX_MESSAGE_DIRECTIONS = ["inbound", "outbound"] as const
export type GrowthInboxMessageDirection = (typeof GROWTH_INBOX_MESSAGE_DIRECTIONS)[number]

export const GROWTH_REPLY_EVENT_SEVERITIES = ["low", "medium", "high", "critical"] as const
export type GrowthReplyEventSeverity = (typeof GROWTH_REPLY_EVENT_SEVERITIES)[number]

export const GROWTH_INBOX_TIMELINE_EVENT_TYPES = [
  "reply_detected",
  "positive_interest_detected",
  "budget_objection_detected",
  "timeline_objection_detected",
  "meeting_interest_detected",
  "unsubscribe_detected",
  "thread_owner_assigned",
  "thread_claimed",
  "thread_handoff",
  "thread_unassigned",
  "thread_sla_overdue",
  "inbox_assignment_rule_applied",
] as const
export type GrowthInboxTimelineEventType = (typeof GROWTH_INBOX_TIMELINE_EVENT_TYPES)[number]

export type GrowthInboxMessage = {
  id: string
  thread_id: string
  direction: GrowthInboxMessageDirection
  sender: string
  recipient: string
  subject: string
  body_preview: string
  message_timestamp: string
  contains_competitor: boolean
  contains_pricing: boolean
  contains_budget: boolean
  contains_meeting_language: boolean
  contains_positive_signal: boolean
  created_at: string
}

export type GrowthInboxThread = {
  id: string
  lead_id: string
  lead_label: string
  channel: "email" | "sms"
  provider_family: string
  mailbox_connection_id: string | null
  subject: string
  thread_status: GrowthInboxThreadStatus
  reply_count: number
  last_message_at: string | null
  owner_user_id: string | null
  owner_label: string | null
  assigned_at?: string | null
  assigned_by?: string | null
  assignment_source?: string | null
  sla_due_at?: string | null
  handoff_note?: string | null
  priority_score: number
  priority_tier: GrowthInboxPriorityTier
  classification: GrowthInboxClassification
  classification_confidence: number
  requires_human_review: boolean
  created_at: string
  updated_at: string
  messages?: GrowthInboxMessage[]
}

export type GrowthReplyIntelligenceEvent = {
  id: string
  thread_id: string
  lead_label: string
  severity: GrowthReplyEventSeverity
  event_type: string
  title: string
  description: string
  metadata: Record<string, unknown>
  created_at: string
}

export type GrowthInboxDashboard = {
  qa_marker: typeof GROWTH_UNIFIED_INBOX_FOUNDATION_QA_MARKER
  open_count: number
  needs_review_count: number
  waiting_count: number
  critical_priority_count: number
  average_priority_score: number
}

export type GrowthReplyIntelligenceSummary = {
  budget: number
  timeline: number
  meeting_intent: number
  positive_interest: number
  competitor: number
  unsubscribe: number
}

export const GROWTH_UNIFIED_INBOX_PRIVACY_NOTE =
  "Unified inbox uses manual message ingestion and deterministic reply intelligence only. No mailbox sync, polling, or auto replies."
