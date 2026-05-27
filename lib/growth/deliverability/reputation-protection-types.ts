/** Growth Deliverability & Reputation Protection System v1 — client-safe types. */

export const GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_QA_MARKER =
  "growth-deliverability-reputation-protection-v1" as const

export const GROWTH_MAILBOX_REPUTATION_INTELLIGENCE_QA_MARKER =
  "growth-mailbox-reputation-intelligence-v1" as const

export const GROWTH_SEND_THROTTLE_ENGINE_QA_MARKER = "growth-send-throttle-engine-v1" as const

export const GROWTH_WARMUP_RAMP_ENGINE_QA_MARKER = "growth-warmup-ramp-engine-v1" as const

export const GROWTH_DELIVERABILITY_GOVERNANCE_QA_MARKER = "growth-deliverability-governance-v1" as const

export const GROWTH_MAILBOX_REPUTATION_HEALTH_TIERS = [
  "healthy",
  "warming",
  "caution",
  "high_risk",
  "protected",
  "paused",
] as const

export type GrowthMailboxReputationHealthTier = (typeof GROWTH_MAILBOX_REPUTATION_HEALTH_TIERS)[number]

export const GROWTH_DELIVERABILITY_GOVERNANCE_EVENT_TYPES = [
  "mailbox_paused",
  "mailbox_recovered",
  "bounce_threshold_triggered",
  "complaint_threshold_triggered",
  "send_throttle_applied",
  "warmup_stage_changed",
  "deliverability_risk_detected",
  "reputation_recovered",
] as const

export type GrowthDeliverabilityGovernanceEventType =
  (typeof GROWTH_DELIVERABILITY_GOVERNANCE_EVENT_TYPES)[number]

export type GrowthMailboxReputationMetrics = {
  sender_account_id: string
  mailbox_connection_id: string | null
  email_address: string
  daily_send_count: number
  rolling_7d_send_volume: number
  rolling_30d_send_volume: number
  bounce_rate: number
  reply_rate: number
  positive_reply_rate: number
  unsubscribe_rate: number
  spam_complaint_rate: number
  open_rate: number
  inactivity_days: number
  sequence_participation_count: number
  warmup_status: string | null
  warmup_progress: number | null
}

export type GrowthMailboxReputationAssessment = {
  metrics: GrowthMailboxReputationMetrics
  risk_score: number
  health_tier: GrowthMailboxReputationHealthTier
  risk_reasons: string[]
  recommended_actions: string[]
  score_explanation: string[]
}

export type GrowthMailboxSendPolicy = {
  sender_account_id: string
  daily_send_cap: number
  hourly_send_cap: number
  minimum_delay_seconds: number
  sequence_concurrency_limit: number
  cooldown_hours: number
  auto_pause_on_bounce_threshold: number
  auto_pause_on_complaint_threshold: number
  operator_override: boolean
  override_reason: string | null
}

export type GrowthSendThrottleDecision = {
  allowed: boolean
  throttled: boolean
  paused: boolean
  reason: string | null
  rule_id: string | null
  recommended_delay_seconds: number | null
}

export type GrowthWarmupRampGuidance = {
  warmup_status: string
  recommended_max_daily_volume: number
  current_ramp_day: number | null
  ramp_schedule_label: string
  unsafe_to_scale: boolean
  progress_pct: number | null
  guidance: string[]
}

export type GrowthDeliverabilityGovernanceEvent = {
  id: string
  event_type: GrowthDeliverabilityGovernanceEventType
  sender_account_id: string | null
  mailbox_connection_id: string | null
  title: string
  summary: string
  severity: "low" | "medium" | "high" | "critical"
  reversible: boolean
  operator_override: boolean
  metadata: Record<string, unknown>
  created_at: string
}

export type GrowthReputationProtectionDashboard = {
  qa_marker: typeof GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_QA_MARKER
  mailbox_reputation_qa_marker: typeof GROWTH_MAILBOX_REPUTATION_INTELLIGENCE_QA_MARKER
  throttle_qa_marker: typeof GROWTH_SEND_THROTTLE_ENGINE_QA_MARKER
  warmup_qa_marker: typeof GROWTH_WARMUP_RAMP_ENGINE_QA_MARKER
  governance_qa_marker: typeof GROWTH_DELIVERABILITY_GOVERNANCE_QA_MARKER
  privacy_note: string
  summary: {
    total_mailboxes: number
    healthy_count: number
    at_risk_count: number
    paused_count: number
    warming_count: number
    average_risk_score: number
  }
  mailbox_health: GrowthMailboxReputationAssessment[]
  at_risk_mailboxes: GrowthMailboxReputationAssessment[]
  paused_mailboxes: GrowthMailboxReputationAssessment[]
  bounce_trends: Array<{ label: string; rate: number; mailbox_count: number }>
  complaint_trends: Array<{ label: string; rate: number; mailbox_count: number }>
  reply_performance: Array<{ label: string; reply_rate: number; positive_reply_rate: number }>
  warmup_progress: GrowthWarmupRampGuidance[]
  sequence_risk: Array<{ label: string; sequence_count: number; risk_score: number }>
  sending_velocity: Array<{ label: string; daily_send_count: number; cap_utilization_pct: number }>
  recommended_actions: string[]
  recent_governance_events: GrowthDeliverabilityGovernanceEvent[]
}

export const GROWTH_REPUTATION_PROTECTION_PRIVACY_NOTE =
  "Deliverability protection is operator-controlled and auditable. Throttle and pause actions generate timeline events — no autonomous outreach or hidden AI send decisions."
