/** Client-safe types for internal outbound operations center (Phase 1). */

export const GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER = "growth-internal-outbound-ops-v1" as const

export const GROWTH_INTERNAL_OUTBOUND_AUDIT_EVENT_TYPES = [
  "sender_operational_pause",
  "sender_cooldown_applied",
  "pre_send_blocked",
  "oauth_failure",
  "token_refresh_failure",
  "send_verification_recorded",
  "domain_risk_alert",
  "cron_execution_failed",
  "outbound_queue_health_alert",
  "qa_deliverability_bypass_used",
  "qa_deliverability_bypass_denied",
] as const

export type GrowthInternalOutboundAuditEventType = (typeof GROWTH_INTERNAL_OUTBOUND_AUDIT_EVENT_TYPES)[number]

export type GrowthInternalOutboundMailboxRow = {
  id: string
  providerFamily: string
  emailAddress: string
  domain: string
  status: string
  healthTier: string
  connectionHealth: number
  oauthConfigured: boolean
  tokenExpiresAt: string | null
  lastValidationAt: string | null
  lastSuccessfulSendAt: string | null
  lastWebhookAt: string | null
  dailySendLimit: number
  dailySendUsed: number
  warmupStage: string
  senderPoolLabels: string[]
  rotationStatus: string
}

export type GrowthInternalOutboundDomainRow = {
  id: string
  domain: string
  readinessStatus: string
  readinessScore: number
  verificationLabel: string
  verificationSource: string
  lastVerifiedAt: string | null
  verificationError: string | null
  manualOverride: boolean
  operationalStatus: string
  spfStatus: string
  dkimStatus: string
  dmarcStatus: string
  mxStatus: string
  trackingDomainReady: boolean
  manualVerificationRequired: boolean
  reputationWarnings: string[]
  healthTier: string
}

export type GrowthInternalOutboundSenderPoolRow = {
  id: string
  name: string
  status: string
  activeSenders: number
  pausedSenders: number
  unhealthySenders: number
  dailyCapacity: number
  dailyUsed: number
  fatigueWarnings: number
  queueLoad: number
  rotationHealth: number
}

export type GrowthInternalOutboundDeliverabilitySummary = {
  bounceRate24h: number
  complaintRate24h: number
  suppressionHits24h: number
  failedSends24h: number
  sent24h: number
  unhealthyMailboxCount: number
}

export type GrowthInternalOutboundAuditEvent = {
  id: string
  eventType: GrowthInternalOutboundAuditEventType
  severity: string
  title: string
  summary: string | null
  createdAt: string
}
