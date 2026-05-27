/** Client-safe Growth Engine compliance types (Phase 2F). */

export const GROWTH_COMPLIANCE_SUPPRESSION_QA_MARKER = "growth-compliance-suppression-v1" as const

export const GROWTH_COMPLIANCE_PRIVACY_NOTE =
  "Compliance intelligence owned by Growth Engine. Hashed recipient identity only — no raw emails or provider secrets. Human authority required; no autonomous sequence decisions."

export const GROWTH_BOUNCE_TYPES = ["hard", "soft", "transient", "blocked", "spam"] as const
export type GrowthBounceType = (typeof GROWTH_BOUNCE_TYPES)[number]

export const GROWTH_COMPLAINT_TYPES = ["spam", "abuse", "manual", "provider"] as const
export type GrowthComplaintType = (typeof GROWTH_COMPLAINT_TYPES)[number]

export const GROWTH_UNSUBSCRIBE_SCOPES = ["global", "organization", "sequence"] as const
export type GrowthUnsubscribeScope = (typeof GROWTH_UNSUBSCRIBE_SCOPES)[number]

export const GROWTH_COMPLIANCE_TIMELINE_EVENT_TYPES = [
  "bounce_detected",
  "hard_bounce_detected",
  "unsubscribe_detected",
  "complaint_detected",
  "suppression_applied",
  "sender_reputation_declined",
] as const

export type GrowthComplianceTimelineEventType = (typeof GROWTH_COMPLIANCE_TIMELINE_EVENT_TYPES)[number]

export const GROWTH_SENDER_REPUTATION_TIERS = ["healthy", "monitor", "warning", "critical"] as const
export type GrowthSenderReputationTier = (typeof GROWTH_SENDER_REPUTATION_TIERS)[number]

export type GrowthEmailBounceRecord = {
  id: string
  deliveryAttemptId: string
  leadId: string | null
  senderAccountId: string
  providerId: string
  bounceType: GrowthBounceType
  providerCode: string | null
  providerReason: string | null
  occurredAt: string
  retryAllowed: boolean
}

export type GrowthEmailComplaintRecord = {
  id: string
  deliveryAttemptId: string
  leadId: string | null
  senderAccountId: string
  providerId: string
  complaintType: GrowthComplaintType
  providerReason: string | null
  occurredAt: string
}

export type GrowthDeliverySuppressionRecord = {
  id: string
  leadId: string | null
  emailHash: string
  reason: string
  active: boolean
  expiresAt: string | null
  createdAt: string
}

export type GrowthUnsubscribeRecord = {
  id: string
  emailHash: string
  scope: GrowthUnsubscribeScope
  organizationId: string | null
  reason: string | null
  source: string
  occurredAt: string
}

export type GrowthSenderReputationSnapshot = {
  score: number
  tier: GrowthSenderReputationTier
  hardBounces: number
  softBounces: number
  complaints: number
  spamEvents: number
  cleanDays: number
}

export type GrowthComplianceDashboard = {
  qa_marker: typeof GROWTH_COMPLIANCE_SUPPRESSION_QA_MARKER
  hardBounceRate: number
  complaintRate: number
  suppressionCount: number
  senderReputation: GrowthSenderReputationSnapshot
  suppressions: GrowthDeliverySuppressionRecord[]
  recentBounces: Array<GrowthEmailBounceRecord & { senderLabel?: string; providerLabel?: string }>
  recentComplaints: Array<GrowthEmailComplaintRecord & { senderLabel?: string; providerLabel?: string }>
}

export type GrowthLeadComplianceDetail = {
  bounces: GrowthEmailBounceRecord[]
  complaints: GrowthEmailComplaintRecord[]
  unsubscribes: GrowthUnsubscribeRecord[]
  suppressions: GrowthDeliverySuppressionRecord[]
  timeline: Array<{
    id: string
    kind: string
    title: string
    summary: string | null
    occurredAt: string
  }>
}

export type GrowthPreSendSuppressionResult = {
  allowed: boolean
  reason: string | null
  blockCode: "unsubscribe" | "suppression" | "complaint" | "hard_bounce" | null
}

export function maskComplianceEmailHash(emailHash: string): string {
  if (!emailHash) return "—"
  return `${emailHash.slice(0, 8)}…${emailHash.slice(-4)}`
}
