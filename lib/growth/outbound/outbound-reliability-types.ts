/** Growth Engine H2 — Outbound Reliability & Recovery (client-safe). */

export const GROWTH_OUTBOUND_RELIABILITY_H2_QA_MARKER = "growth-outbound-reliability-h2-v1" as const

export const GROWTH_OUTBOUND_OPERATIONS_RUNTIME_STABLE_QA_MARKER =
  "growth-outbound-operations-runtime-stable-v1" as const

export type GrowthOutboundOperationsFailureReason =
  | "fetch_failed"
  | "schema_not_ready"
  | "permission_blocked"
  | "render_error"
  | "unknown"

export const GROWTH_PROVIDER_FAILURE_CLASSES = [
  "auth_failure",
  "rate_limit",
  "quota_exceeded",
  "reputation_blocked",
  "mailbox_paused",
  "suppression_blocked",
  "provider_unavailable",
  "timeout",
  "validation_failed",
  "unknown",
] as const

export type GrowthProviderFailureClass = (typeof GROWTH_PROVIDER_FAILURE_CLASSES)[number]

export const GROWTH_OUTBOUND_SEND_PLANES = ["transport", "adapter"] as const
export type GrowthOutboundSendPlane = (typeof GROWTH_OUTBOUND_SEND_PLANES)[number]

export const GROWTH_OUTBOUND_QUEUE_RECOVERY_STATUSES = ["failed", "dead_letter"] as const
export type GrowthOutreachQueueRecoveryStatus = (typeof GROWTH_OUTBOUND_QUEUE_RECOVERY_STATUSES)[number]

export const GROWTH_OUTBOUND_QUEUE_HEALTH_ALERT_RULES = [
  "scheduled_overdue",
  "stuck_processing",
  "repeated_provider_failure",
  "sequence_enrollment_stalled",
  "cron_stale",
  "queue_lag_high",
] as const

export type GrowthOutboundQueueHealthAlertSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "setup"
  | "informational"
  | "pending_activation"

export type GrowthOutboundQueueHealthAlertRule = (typeof GROWTH_OUTBOUND_QUEUE_HEALTH_ALERT_RULES)[number]

export type GrowthOutboundQueueHealthAlertKind = "setup" | "informational" | "outage"

export type GrowthProviderFailureClassification = {
  failure_class: GrowthProviderFailureClass
  retry_eligible: boolean
  operator_summary: string
}

export type GrowthOutreachQueueRecoveryItem = {
  queue_id: string
  lead_id: string
  channel: string
  status: string
  failure_reason: string | null
  failure_class: GrowthProviderFailureClass | null
  retry_count: number
  retry_eligible: boolean
  dead_letter_at: string | null
  failed_at: string | null
  scheduled_for: string | null
  delivery_attempt_id: string | null
  company_name?: string
}

export type GrowthOutboundQueueHealthAlert = {
  rule_id: GrowthOutboundQueueHealthAlertRule
  severity: GrowthOutboundQueueHealthAlertSeverity
  alert_kind?: GrowthOutboundQueueHealthAlertKind
  title: string
  summary: string
  count: number
  metadata: Record<string, unknown>
}

export const GROWTH_OUTBOUND_RELIABILITY_MAX_RETRIES = 3

export const GROWTH_OUTBOUND_RELIABILITY_H2_MIGRATION =
  "20270605120000_growth_outbound_reliability_h2.sql" as const

export const GROWTH_OUTBOUND_RELIABILITY_PRIVACY_NOTE =
  "Outbound recovery is operator-controlled. Replays re-run suppression and deliverability gates — no silent bypass."
