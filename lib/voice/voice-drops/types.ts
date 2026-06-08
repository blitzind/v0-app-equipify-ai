/** Voice drop infrastructure — Phase 4B shared types (client-safe). */

export const VOICE_DROP_INFRASTRUCTURE_QA_MARKER = "voice-drop-infrastructure-v1" as const

export const VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED = true as const
export const VOICE_DROP_APPROVAL_REQUIRED = true as const

export const VOICE_DROP_CAMPAIGN_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "scheduled",
  "running",
  "paused",
  "completed",
  "failed",
  "canceled",
] as const

export type VoiceDropCampaignStatus = (typeof VOICE_DROP_CAMPAIGN_STATUSES)[number]

export const VOICE_DROP_CAMPAIGN_TYPES = [
  "voicemail_drop",
  "ringless_voicemail",
  "callback_follow_up",
  "personalized_voicemail",
] as const

export type VoiceDropCampaignType = (typeof VOICE_DROP_CAMPAIGN_TYPES)[number]

export const VOICE_DROP_APPROVAL_STATUSES = ["draft", "pending_approval", "approved", "rejected"] as const

export type VoiceDropApprovalStatus = (typeof VOICE_DROP_APPROVAL_STATUSES)[number]

export const VOICE_DROP_RECIPIENT_STATUSES = [
  "pending",
  "suppressed",
  "queued",
  "delivered",
  "failed",
  "skipped",
] as const

export type VoiceDropRecipientStatus = (typeof VOICE_DROP_RECIPIENT_STATUSES)[number]

export const VOICE_DROP_DELIVERY_STATUSES = [
  "queued",
  "in_progress",
  "delivered",
  "failed",
  "canceled",
] as const

export type VoiceDropDeliveryStatus = (typeof VOICE_DROP_DELIVERY_STATUSES)[number]

export const VOICE_DROP_PROVIDERS = ["stub", "twilio", "ringless_future"] as const

export type VoiceDropProviderId = (typeof VOICE_DROP_PROVIDERS)[number]

export const VOICE_DROP_ALLOWED_PERSONALIZATION_TOKENS = [
  "first_name",
  "company_name",
  "assigned_rep",
  "service_type",
  "callback_number",
  "appointment_window",
  "last_interaction_summary",
] as const

export type VoiceDropPersonalizationToken = (typeof VOICE_DROP_ALLOWED_PERSONALIZATION_TOKENS)[number]

export const VOICE_DROP_MAX_RECIPIENTS_PER_CAMPAIGN = 500 as const
export const VOICE_DROP_FREQUENCY_CAP_DAYS = 7 as const
export const VOICE_DROP_MAX_DELIVERY_ATTEMPTS = 3 as const

export type VoiceDropCampaignPublicView = {
  id: string
  organizationId: string
  name: string
  status: VoiceDropCampaignStatus
  campaignType: VoiceDropCampaignType
  messageTemplate: string
  voiceProvider: VoiceDropProviderId
  voiceId: string | null
  approvalStatus: VoiceDropApprovalStatus
  scheduledAt: string | null
  createdBy: string | null
  recipientCount: number
  suppressedCount: number
  deliveredCount: number
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceDropRecipientPublicView = {
  id: string
  organizationId: string
  campaignId: string
  relatedCustomerId: string | null
  relatedProspectId: string | null
  phoneNumber: string
  recipientName: string | null
  status: VoiceDropRecipientStatus
  suppressionReason: string | null
  complianceDecision: "allowed" | "blocked" | "manual_review_required" | null
  complianceReasons: string[]
  manualReviewRequired: boolean
  deliveryAttemptCount: number
  lastAttemptAt: string | null
  renderedMessagePreview: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceDropDeliveryAttemptPublicView = {
  id: string
  organizationId: string
  campaignId: string
  recipientId: string
  provider: VoiceDropProviderId
  providerDeliveryId: string | null
  status: VoiceDropDeliveryStatus
  failureReason: string | null
  deliveredAt: string | null
  durationSeconds: number | null
  costAmount: number | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type VoiceDropCampaignDashboardSnapshot = {
  qaMarker: typeof VOICE_DROP_INFRASTRUCTURE_QA_MARKER
  generatedAt: string
  campaigns: VoiceDropCampaignPublicView[]
  pendingApprovalCount: number
  runningCount: number
  autonomousOutboundDisabled: true
  approvalRequired: true
  message: string
}

export type VoiceDropReadinessSnapshot = {
  qaMarker: typeof VOICE_DROP_INFRASTRUCTURE_QA_MARKER
  schemaReady: boolean
  voiceDropEnabled: boolean
  providerMode: VoiceDropProviderId
  complianceGatingReady: boolean
  approvalWorkflowEnabled: boolean
  optOutRegistryReady: boolean
  callHourRulesReady: boolean
  autonomousOutboundDisabled: true
  twilioOutboundCertified: boolean
  message: string
}

export type VoiceDropComplianceSummary = {
  eligibleCount: number
  suppressedCount: number
  manualReviewCount: number
  reasons: Array<{ reason: string; count: number }>
}
