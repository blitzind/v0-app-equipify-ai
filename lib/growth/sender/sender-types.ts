/** Growth Engine — Sender Infrastructure types (Phase 1A). Client-safe. */

export const GROWTH_SENDER_INFRASTRUCTURE_QA_MARKER = "growth-sender-infrastructure-v1" as const

export const GROWTH_SENDER_PROVIDER_FAMILIES = ["google", "microsoft", "smtp", "custom"] as const
export type GrowthSenderProviderFamily = (typeof GROWTH_SENDER_PROVIDER_FAMILIES)[number]

export const GROWTH_SENDER_ACCOUNT_STATUSES = [
  "pending",
  "connecting",
  "connected",
  "warning",
  "disabled",
  "error",
] as const
export type GrowthSenderAccountStatus = (typeof GROWTH_SENDER_ACCOUNT_STATUSES)[number]

export const GROWTH_SENDER_HEALTH_STATUSES = ["healthy", "warming", "degraded", "critical"] as const
export type GrowthSenderHealthStatus = (typeof GROWTH_SENDER_HEALTH_STATUSES)[number]

export const GROWTH_SENDER_DOMAIN_STATUSES = ["pending", "valid", "warning", "invalid"] as const
export type GrowthSenderDomainStatus = (typeof GROWTH_SENDER_DOMAIN_STATUSES)[number]

export const GROWTH_SENDER_HEALTH_EVENT_SEVERITIES = ["low", "medium", "high", "critical"] as const
export type GrowthSenderHealthEventSeverity = (typeof GROWTH_SENDER_HEALTH_EVENT_SEVERITIES)[number]

export const GROWTH_SENDER_TIMELINE_EVENT_TYPES = [
  "sender_connected",
  "sender_disabled",
  "sender_score_changed",
  "domain_health_declined",
  "domain_validated",
] as const
export type GrowthSenderTimelineEventType = (typeof GROWTH_SENDER_TIMELINE_EVENT_TYPES)[number]

export type GrowthSenderAccount = {
  id: string
  provider_family: GrowthSenderProviderFamily
  provider_connection_id: string | null
  display_name: string
  email_address: string
  status: GrowthSenderAccountStatus
  daily_send_limit: number
  daily_send_used: number
  warmup_eligible: boolean
  warmup_enabled: boolean
  sender_score: number
  health_status: GrowthSenderHealthStatus
  last_health_check: string | null
  last_send_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type GrowthSenderDomain = {
  id: string
  domain: string
  status: GrowthSenderDomainStatus
  spf_valid: boolean
  dkim_valid: boolean
  dmarc_valid: boolean
  mx_valid: boolean
  dns_checked_at: string | null
  deliverability_score: number
  reputation_score: number
  bounce_rate: number | null
  reply_rate: number | null
  spam_risk: number | null
  health_summary: string | null
  created_at: string
  updated_at: string
}

export type GrowthSenderHealthEvent = {
  id: string
  sender_account_id: string | null
  domain_id: string | null
  event_type: string
  severity: GrowthSenderHealthEventSeverity
  title: string
  description: string
  metadata: Record<string, unknown>
  resolved: boolean
  resolved_at: string | null
  created_at: string
}

export type GrowthSenderInfrastructureDashboard = {
  qa_marker: typeof GROWTH_SENDER_INFRASTRUCTURE_QA_MARKER
  connected_senders: number
  healthy_senders: number
  warning_senders: number
  disabled_senders: number
  healthy_senders_count: number
  warming_senders: number
  critical_domains: number
  average_sender_score: number
  health_events_24h: number
}

export const GROWTH_SENDER_INFRASTRUCTURE_PRIVACY_NOTE =
  "Sender infrastructure is platform-admin only. No secrets, credentials, or outbound sending in Phase 1A."
