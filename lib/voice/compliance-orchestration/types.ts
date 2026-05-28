/** Compliance orchestration — Phase 4C shared types (client-safe). */

export const VOICE_COMPLIANCE_ORCHESTRATION_QA_MARKER = "voice-compliance-orchestration-v1" as const

export const VOICE_COMPLIANCE_AUTONOMOUS_OUTBOUND_DISABLED = true as const
export const VOICE_COMPLIANCE_CONSERVATIVE_DEFAULT = true as const

export const VOICE_CONSENT_CHANNELS = [
  "voice_call",
  "sms",
  "voicemail",
  "ringless_voicemail",
  "email",
  "ai_receptionist",
  "callback",
] as const

export type VoiceConsentChannel = (typeof VOICE_CONSENT_CHANNELS)[number]

export const VOICE_CONSENT_STATUSES = [
  "unknown",
  "granted",
  "denied",
  "revoked",
  "expired",
  "manual_review_required",
] as const

export type VoiceConsentStatus = (typeof VOICE_CONSENT_STATUSES)[number]

export const VOICE_SUPPRESSION_TYPES = [
  "opt_out",
  "dnc",
  "complaint",
  "invalid_number",
  "high_frequency",
  "outside_call_hours",
  "consent_unknown",
  "manual_review",
  "relationship_suppression",
  "legal_hold",
  "provider_reputation",
] as const

export type VoiceSuppressionType = (typeof VOICE_SUPPRESSION_TYPES)[number]

export const VOICE_DNC_SCOPES = ["organization", "global", "campaign", "relationship"] as const

export type VoiceDncScope = (typeof VOICE_DNC_SCOPES)[number]

export const VOICE_COMPLIANCE_DECISIONS = ["allowed", "blocked", "manual_review_required"] as const

export type VoiceComplianceDecision = (typeof VOICE_COMPLIANCE_DECISIONS)[number]

export const VOICE_COMPLIANCE_AUDIT_ACTIONS = [
  "consent_captured",
  "consent_revoked",
  "suppression_added",
  "suppression_expired",
  "compliance_evaluated",
  "send_blocked",
  "manual_review_required",
  "campaign_approved",
  "campaign_rejected",
  "opt_out_propagated",
  "manual_review_approved",
  "manual_review_rejected",
  "consent_granted",
  "consent_denied",
] as const

export type VoiceComplianceAuditAction = (typeof VOICE_COMPLIANCE_AUDIT_ACTIONS)[number]

export const VOICE_COMPLIANCE_BATCH_PREVIEW_LIMIT = 500 as const
export const VOICE_COMPLIANCE_FREQUENCY_CAP_DAYS = 7 as const

export type VoiceConsentRecordPublicView = {
  id: string
  organizationId: string
  relatedCustomerId: string | null
  relatedProspectId: string | null
  relationshipMemoryProfileId: string | null
  phoneNumber: string
  consentChannel: VoiceConsentChannel
  consentStatus: VoiceConsentStatus
  consentSource: string
  evidenceText: string
  capturedAt: string
  expiresAt: string | null
  revokedAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceSuppressionEntryPublicView = {
  id: string
  organizationId: string
  phoneNumber: string
  suppressionType: VoiceSuppressionType
  suppressionReason: string
  source: string
  severity: string
  startsAt: string
  expiresAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type VoiceDncEntryPublicView = {
  id: string
  organizationId: string
  phoneNumber: string
  source: string
  scope: VoiceDncScope
  reason: string
  startsAt: string
  expiresAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type VoiceCallHourRulePublicView = {
  id: string
  organizationId: string
  name: string
  timezone: string
  allowedDays: string[]
  allowedStartTime: string
  allowedEndTime: string
  channel: VoiceConsentChannel | null
  campaignType: string | null
  isDefault: boolean
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceComplianceAuditEventPublicView = {
  id: string
  organizationId: string
  phoneNumber: string | null
  channel: VoiceConsentChannel | null
  action: VoiceComplianceAuditAction
  decision: VoiceComplianceDecision | null
  evidence: Record<string, unknown>
  createdBy: string | null
  createdAt: string
}

export type CommunicationComplianceEvaluationInput = {
  organizationId: string
  phoneNumber: string
  channel: VoiceConsentChannel
  campaignType?: string | null
  intendedSendAt?: string | null
  relationshipMemoryProfileId?: string | null
  relatedCustomerId?: string | null
  relatedProspectId?: string | null
}

export type CommunicationComplianceEvaluationContext = {
  isOptedOut: boolean
  activeSuppressions: VoiceSuppressionEntryPublicView[]
  consentStatus: VoiceConsentStatus
  dncListed: boolean | null
  duplicateInCampaign: boolean
  recentContactWithinCap: boolean
  relationshipSuppressed: boolean
  callHourRule: VoiceCallHourRulePublicView | null
  timezoneKnown: boolean
  withinCallHours: boolean | null
  providerReputationFlag: boolean
}

export type CommunicationComplianceResult = {
  decision: VoiceComplianceDecision
  allowed: boolean
  blocked: boolean
  manualReviewRequired: boolean
  reasons: string[]
  requiredActions: string[]
  evidence: string[]
  expiresAt: string | null
}

export type VoiceComplianceReadinessSnapshot = {
  qaMarker: typeof VOICE_COMPLIANCE_ORCHESTRATION_QA_MARKER
  schemaReady: boolean
  orchestrationEnabled: boolean
  consentReadiness: boolean
  suppressionCount: number
  dncCount: number
  optOutCount: number
  manualReviewQueueCount: number
  callHourRulesReady: boolean
  auditEventCount: number
  conservativeDefault: true
  autonomousOutboundDisabled: true
  message: string
}

export type VoiceComplianceManualReviewItem = {
  id: string
  phoneNumber: string
  channel: VoiceConsentChannel
  decision: VoiceComplianceDecision
  reasons: string[]
  source: "voice_drop_recipient" | "missed_call_recovery" | "compliance_audit"
  sourceId: string | null
  createdAt: string
  metadata: Record<string, unknown>
}

export type VoiceComplianceManualReviewQueueSnapshot = {
  qaMarker: typeof VOICE_COMPLIANCE_ORCHESTRATION_QA_MARKER
  generatedAt: string
  items: VoiceComplianceManualReviewItem[]
  blockedCount: number
  manualReviewCount: number
  message: string
}
