/** Phase 6.31B — Mailbox health intelligence (client-safe). */

export const GROWTH_MAILBOX_HEALTH_INTELLIGENCE_QA_MARKER =
  "growth-mailbox-health-intelligence-v1" as const

export const GROWTH_MAILBOX_HEALTH_INTELLIGENCE_MIGRATION =
  "20270705120000_growth_mailbox_health_intelligence.sql" as const

export const GROWTH_MAILBOX_HEALTH_STATES = [
  "healthy",
  "warning",
  "at_risk",
  "critical",
  "disabled",
] as const

export type GrowthMailboxHealthState = (typeof GROWTH_MAILBOX_HEALTH_STATES)[number]

export type GrowthMailboxHealthTrendPoint = {
  snapshot_date: string
  health_score: number
  health_state: GrowthMailboxHealthState
  risk_score_delta: number | null
}

export type GrowthMailboxHealthIntelRow = {
  sender_account_id: string
  mailbox_connection_id: string | null
  email_address: string
  health_score: number
  health_state: GrowthMailboxHealthState
  reputation_tier: string
  warmup_status: string | null
  warmup_progress: number | null
  daily_capacity: number
  sends_today: number
  bounce_rate: number
  reply_rate: number
  complaint_rate: number
  unsubscribe_rate: number
  delivery_success_rate: number
  send_volume_7d: number
  throttle_status: "ok" | "throttled" | "paused"
  throttle_recommendation: string | null
  capacity_recommendation: string | null
  health_trend: GrowthMailboxHealthTrendPoint[]
  primary_risk_reason: string | null
}

export type GrowthMailboxHealthDashboard = {
  qa_marker: typeof GROWTH_MAILBOX_HEALTH_INTELLIGENCE_QA_MARKER
  privacy_note: string
  summary: {
    total_mailboxes: number
    healthy_count: number
    warning_count: number
    at_risk_count: number
    critical_count: number
    disabled_count: number
    average_health_score: number
    throttled_count: number
    paused_count: number
  }
  mailboxes: GrowthMailboxHealthIntelRow[]
  recommended_actions: string[]
  last_calculated_at: string
}
