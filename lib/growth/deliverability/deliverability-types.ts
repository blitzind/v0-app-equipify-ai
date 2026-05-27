/** Growth Engine — DNS + Deliverability types (Phase 1C). Client-safe. */

export const GROWTH_DNS_DELIVERABILITY_QA_MARKER = "growth-dns-deliverability-v1" as const

export const GROWTH_DNS_HEALTH_TIERS = ["healthy", "warning", "degraded", "critical"] as const
export type GrowthDnsHealthTier = (typeof GROWTH_DNS_HEALTH_TIERS)[number]

export const GROWTH_DELIVERABILITY_RISK_LEVELS = ["low", "medium", "high", "critical"] as const
export type GrowthDeliverabilityRiskLevel = (typeof GROWTH_DELIVERABILITY_RISK_LEVELS)[number]

export const GROWTH_DELIVERABILITY_EVENT_SEVERITIES = ["low", "medium", "high", "critical"] as const
export type GrowthDeliverabilityEventSeverity = (typeof GROWTH_DELIVERABILITY_EVENT_SEVERITIES)[number]

export const GROWTH_DELIVERABILITY_TIMELINE_EVENT_TYPES = [
  "spf_missing",
  "dkim_missing",
  "dmarc_missing",
  "dns_health_declined",
  "deliverability_improved",
  "domain_warning_created",
] as const
export type GrowthDeliverabilityTimelineEventType = (typeof GROWTH_DELIVERABILITY_TIMELINE_EVENT_TYPES)[number]

export type GrowthDnsCheckResult = {
  spf_present: boolean
  spf_valid: boolean
  dkim_present: boolean
  dkim_valid: boolean
  dmarc_present: boolean
  dmarc_valid: boolean
  mx_present: boolean
  mx_valid: boolean
  mx_provider: string | null
}

export type GrowthDomainDnsCheck = GrowthDnsCheckResult & {
  id: string
  domain_id: string
  domain: string
  dns_health_score: number
  health_tier: GrowthDnsHealthTier
  warnings: string[]
  recommendations: string[]
  last_checked_at: string
  created_at: string
  updated_at: string
}

export type GrowthDeliverabilitySnapshot = {
  id: string
  domain_id: string
  snapshot_date: string
  deliverability_score: number
  bounce_risk: number
  spam_risk: number
  authentication_score: number
  infrastructure_score: number
  health_summary: string | null
  risk_level: GrowthDeliverabilityRiskLevel
  created_at: string
}

export type GrowthDeliverabilityEvent = {
  id: string
  domain_id: string
  domain: string
  severity: GrowthDeliverabilityEventSeverity
  event_type: string
  title: string
  description: string
  metadata: Record<string, unknown>
  resolved: boolean
  resolved_at: string | null
  created_at: string
}

export type GrowthDeliverabilityDashboard = {
  qa_marker: typeof GROWTH_DNS_DELIVERABILITY_QA_MARKER
  healthy_count: number
  warning_count: number
  critical_count: number
  average_score: number
  spf_coverage_percent: number
  dkim_coverage_percent: number
  dmarc_coverage_percent: number
  mx_coverage_percent: number
  top_recommendations: Array<{ recommendation: string; count: number }>
}

export type GrowthDeliverabilityDomainRow = {
  domain_id: string
  domain: string
  spf_present: boolean
  spf_valid: boolean
  dkim_present: boolean
  dkim_valid: boolean
  dmarc_present: boolean
  dmarc_valid: boolean
  mx_present: boolean
  mx_valid: boolean
  dns_health_score: number
  health_tier: GrowthDnsHealthTier
  deliverability_score: number
  risk_level: GrowthDeliverabilityRiskLevel
  last_checked_at: string | null
  recommendations: string[]
}

export const GROWTH_DNS_DELIVERABILITY_PRIVACY_NOTE =
  "Deliverability intelligence uses stub-safe DNS checks only. No live DNS mutation or inbox placement testing."
