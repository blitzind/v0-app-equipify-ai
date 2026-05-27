/** Client-safe deliverability intelligence types (Phase 2). */

export const GROWTH_DELIVERABILITY_INTELLIGENCE_QA_MARKER = "growth-deliverability-intelligence-v1" as const

export const GROWTH_DNS_VERIFICATION_SOURCES = ["stub", "live", "manual_override"] as const
export type GrowthDnsVerificationSource = (typeof GROWTH_DNS_VERIFICATION_SOURCES)[number]

export const GROWTH_DOMAIN_OPERATIONAL_STATUSES = [
  "healthy",
  "warming",
  "degraded",
  "critical",
  "paused",
] as const
export type GrowthDomainOperationalStatus = (typeof GROWTH_DOMAIN_OPERATIONAL_STATUSES)[number]

export const GROWTH_DELIVERY_TIMELINE_EVENT_TYPES = [
  "sent",
  "delivered",
  "bounced",
  "complained",
  "opened",
  "clicked",
  "unsubscribed",
  "provider_rejected",
  "throttled",
  "oauth_failed",
  "dns_failure",
  "send_failure",
  "sender_paused",
  "webhook_outage",
  "protection_applied",
] as const
export type GrowthDeliveryTimelineEventType = (typeof GROWTH_DELIVERY_TIMELINE_EVENT_TYPES)[number]

export const GROWTH_DELIVERABILITY_PROTECTION_ACTIONS = [
  "warn",
  "degrade",
  "cooldown",
  "pause_sender",
  "pause_domain",
  "restrict_rotation",
] as const
export type GrowthDeliverabilityProtectionAction = (typeof GROWTH_DELIVERABILITY_PROTECTION_ACTIONS)[number]

export type GrowthDomainReadinessCard = {
  domainId: string
  domain: string
  verificationSource: GrowthDnsVerificationSource
  verificationLabel: string
  lastVerifiedAt: string | null
  verificationError: string | null
  manualOverride: boolean
  spfStatus: string
  dkimStatus: string
  dmarcStatus: string
  mxStatus: string
  trackingDomainReady: boolean
  readinessScore: number
  domainHealthScore: number
  domainRiskLevel: string
  operationalStatus: GrowthDomainOperationalStatus
  riskReasons: string[]
  recommendations: string[]
}

export type GrowthDeliverabilityTimelineEntry = {
  id: string
  normalizedType: GrowthDeliveryTimelineEventType
  severity: string
  title: string
  summary: string | null
  occurredAt: string
  providerFamily: string | null
}

export type GrowthDomainSenderMapping = {
  domain: string
  domainId: string
  senderCount: number
  poolCount: number
  senders: string[]
  pools: string[]
  concentrationRisk: "low" | "medium" | "high"
}
