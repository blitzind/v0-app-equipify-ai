/** Client-safe Growth Engine deliverability operations types (Phase 2R). */

export const GROWTH_DELIVERABILITY_OPS_QA_MARKER = "growth-deliverability-ops-v1" as const

export const GROWTH_DELIVERABILITY_OPS_PRIVACY_NOTE =
  "Deliverability ops is platform-admin only. Recommendations are advisory — human approval required for every remediation. No autonomous DNS changes, sender disabling, volume changes, provider switching, or compliance bypass."

export const GROWTH_DELIVERABILITY_OPS_STATUSES = [
  "open",
  "acknowledged",
  "in_progress",
  "completed",
  "dismissed",
] as const
export type GrowthDeliverabilityOpsStatus = (typeof GROWTH_DELIVERABILITY_OPS_STATUSES)[number]

export const GROWTH_DELIVERABILITY_RISK_TYPES = [
  "spf_failure",
  "dkim_failure",
  "dmarc_failure",
  "bounce_spike",
  "complaint_spike",
  "unsubscribe_spike",
  "open_rate_drop",
  "click_rate_drop",
  "reply_rate_drop",
  "sender_fatigue",
  "warmup_mismatch",
  "provider_degradation",
  "domain_reputation_drop",
  "rate_limit_pressure",
] as const
export type GrowthDeliverabilityRiskType = (typeof GROWTH_DELIVERABILITY_RISK_TYPES)[number]

export const GROWTH_DELIVERABILITY_RECOMMENDATION_TYPES = [
  "pause_sender",
  "reduce_volume",
  "rotate_sender",
  "increase_warmup",
  "fix_spf",
  "fix_dkim",
  "fix_dmarc",
  "review_copy",
  "review_targeting",
  "switch_provider_route",
  "suppress_bad_leads",
  "investigate_domain",
] as const
export type GrowthDeliverabilityRecommendationType =
  (typeof GROWTH_DELIVERABILITY_RECOMMENDATION_TYPES)[number]

export const GROWTH_DELIVERABILITY_ENTITY_TYPES = [
  "platform",
  "sender",
  "domain",
  "provider",
  "pool",
  "route",
] as const
export type GrowthDeliverabilityEntityType = (typeof GROWTH_DELIVERABILITY_ENTITY_TYPES)[number]

export const GROWTH_DELIVERABILITY_SEVERITIES = ["low", "medium", "high", "critical"] as const
export type GrowthDeliverabilitySeverity = (typeof GROWTH_DELIVERABILITY_SEVERITIES)[number]

export const GROWTH_DELIVERABILITY_DOMAIN_TRENDS = ["stable", "improving", "declining"] as const
export type GrowthDeliverabilityDomainTrend = (typeof GROWTH_DELIVERABILITY_DOMAIN_TRENDS)[number]

export type GrowthDeliverabilityEvidenceSnippet = {
  label: string
  value: string
  source: string
}

export type GrowthDeliverabilityOpsSnapshot = {
  id: string
  overallScore: number
  senderReputationScore: number
  domainHealthScore: number
  providerHealthScore: number
  complianceRiskScore: number
  warmupHealthScore: number
  volumePressureScore: number
  openRiskAlerts: number
  recordedAt: string
}

export type GrowthDeliverabilityRecommendation = {
  id: string
  recommendationType: GrowthDeliverabilityRecommendationType
  status: GrowthDeliverabilityOpsStatus
  title: string
  description: string
  evidence: GrowthDeliverabilityEvidenceSnippet[]
  severity: GrowthDeliverabilitySeverity
  entityType: GrowthDeliverabilityEntityType
  entityLabel: string
  acknowledgedAt: string | null
  completedAt: string | null
  dismissedAt: string | null
  dismissReason: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthDeliverabilityRiskEvent = {
  id: string
  riskType: GrowthDeliverabilityRiskType
  severity: GrowthDeliverabilitySeverity
  title: string
  description: string
  entityType: GrowthDeliverabilityEntityType
  entityLabel: string
  resolved: boolean
  createdAt: string
}

export type GrowthDeliverabilityRemediationChecklistItem = {
  id: string
  label: string
  completed: boolean
}

export type GrowthDeliverabilityRemediationTask = {
  id: string
  recommendationId: string | null
  riskEventId: string | null
  taskType: string
  status: GrowthDeliverabilityOpsStatus
  title: string
  description: string
  checklist: GrowthDeliverabilityRemediationChecklistItem[]
  entityType: GrowthDeliverabilityEntityType
  entityLabel: string
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthDeliverabilityDomainReputationRow = {
  id: string
  domainLabel: string
  reputationScore: number
  bounceRate: number
  complaintRate: number
  authenticationScore: number
  trend: GrowthDeliverabilityDomainTrend
  recordedAt: string
}

export type GrowthDeliverabilitySenderRiskSummary = {
  entityLabel: string
  riskCount: number
  highestSeverity: GrowthDeliverabilitySeverity
  topRiskType: GrowthDeliverabilityRiskType | null
}

export type GrowthDeliverabilityProviderRouteRiskSummary = {
  entityLabel: string
  riskCount: number
  highestSeverity: GrowthDeliverabilitySeverity
  topRiskType: GrowthDeliverabilityRiskType | null
}

export type GrowthDeliverabilityOpsDashboard = {
  qa_marker: typeof GROWTH_DELIVERABILITY_OPS_QA_MARKER
  overallDeliverability: number
  senderReputation: number
  domainHealth: number
  providerHealth: number
  complianceRisk: number
  warmupHealth: number
  volumePressure: number
  riskAlerts: number
  latestSnapshot: GrowthDeliverabilityOpsSnapshot | null
  recommendations: GrowthDeliverabilityRecommendation[]
  riskEvents: GrowthDeliverabilityRiskEvent[]
  remediationTasks: GrowthDeliverabilityRemediationTask[]
  domainReputationHistory: GrowthDeliverabilityDomainReputationRow[]
  senderRiskSummary: GrowthDeliverabilitySenderRiskSummary[]
  providerRouteRiskSummary: GrowthDeliverabilityProviderRouteRiskSummary[]
}

export function deliverabilityOpsStatusLabel(status: GrowthDeliverabilityOpsStatus): string {
  switch (status) {
    case "open":
      return "Open"
    case "acknowledged":
      return "Acknowledged"
    case "in_progress":
      return "In progress"
    case "completed":
      return "Completed"
    case "dismissed":
      return "Dismissed"
    default:
      return status
  }
}

export function deliverabilityRiskTypeLabel(type: GrowthDeliverabilityRiskType): string {
  return type.replace(/_/g, " ")
}

export function deliverabilityRecommendationTypeLabel(
  type: GrowthDeliverabilityRecommendationType,
): string {
  switch (type) {
    case "pause_sender":
      return "Pause sender"
    case "reduce_volume":
      return "Reduce volume"
    case "rotate_sender":
      return "Rotate sender"
    case "increase_warmup":
      return "Increase warmup"
    case "fix_spf":
      return "Fix SPF"
    case "fix_dkim":
      return "Fix DKIM"
    case "fix_dmarc":
      return "Fix DMARC"
    case "review_copy":
      return "Review copy"
    case "review_targeting":
      return "Review targeting"
    case "switch_provider_route":
      return "Switch provider route"
    case "suppress_bad_leads":
      return "Suppress bad leads"
    case "investigate_domain":
      return "Investigate domain"
    default:
      return type
  }
}

export function deliverabilitySeverityLabel(severity: GrowthDeliverabilitySeverity): string {
  switch (severity) {
    case "low":
      return "Low"
    case "medium":
      return "Medium"
    case "high":
      return "High"
    case "critical":
      return "Critical"
    default:
      return severity
  }
}

export function maskDomainLabel(domain: string): string {
  const trimmed = domain.trim().toLowerCase()
  if (!trimmed) return "Domain"
  const parts = trimmed.split(".")
  if (parts.length < 2) return `${trimmed.slice(0, 2)}***`
  const tld = parts.slice(-2).join(".")
  return `***.${tld}`
}

export function maskSenderEntityLabel(email: string, displayName?: string | null): string {
  const name = (displayName ?? "").trim()
  if (name) return name.slice(0, 80)
  const at = email.indexOf("@")
  if (at <= 1) return "Sender"
  return `${email.slice(0, 1)}***${email.slice(at)}`
}
