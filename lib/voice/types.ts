/** Voice Infrastructure Foundation — Phase 1A shared types (client-safe). */

import type { VoiceCallControlReadinessSnapshot, VoiceRecordingPolicy } from "@/lib/voice/call-control/types"
import type { VoiceMediaStreamingReadinessSnapshot } from "@/lib/voice/media-streaming/types"
import type { VoiceTransferControlReadinessSnapshot } from "@/lib/voice/transfer-control/types"

export const VOICE_FOUNDATION_QA_MARKER = "voice-foundation-v1" as const
export const VOICE_PROVIDER_ABSTRACTION_QA_MARKER = "voice-provider-abstraction-v1" as const
export const VOICE_WEBHOOK_INGESTION_QA_MARKER = "voice-webhook-ingestion-v1" as const
export const VOICE_OPERATIONS_QA_MARKER = "voice-operations-v1" as const

export {
  VOICE_CALL_CONTROL_QA_MARKER,
  VOICE_RECORDING_POLICIES,
  VOICE_RECORDING_POLICY_LABELS,
  type VoiceRecordingPolicy,
  type VoiceCallControlSettingsRecord,
  type VoiceCallControlReadinessSnapshot,
  type InboundCallControlDecision,
} from "@/lib/voice/call-control/types"

export {
  VOICE_TRANSFER_CONTROL_QA_MARKER,
  type VoiceTransferControlReadinessSnapshot,
  type VoiceConferenceParticipantPublicView,
  type VoiceCallTransferPublicView,
} from "@/lib/voice/transfer-control/types"

export {
  VOICE_MEDIA_STREAMING_QA_MARKER,
  type VoiceMediaStreamingReadinessSnapshot,
  type VoiceCallTranscriptSnapshot,
  type VoiceTranscriptSegmentPublicView,
} from "@/lib/voice/media-streaming/types"

export const VOICE_PROVIDER_IDS = ["twilio", "telnyx", "plivo", "sip", "stub"] as const
export type VoiceProviderId = (typeof VOICE_PROVIDER_IDS)[number]

export const VOICE_CALL_STATUSES = [
  "queued",
  "initiated",
  "ringing",
  "in_progress",
  "completed",
  "failed",
  "busy",
  "no_answer",
  "canceled",
] as const
export type VoiceCallStatus = (typeof VOICE_CALL_STATUSES)[number]

export const VOICE_CALL_DIRECTIONS = ["inbound", "outbound"] as const
export type VoiceCallDirection = (typeof VOICE_CALL_DIRECTIONS)[number]

export const VOICE_CALL_DISPOSITIONS = [
  "connected",
  "voicemail",
  "no_answer",
  "wrong_number",
  "qualified",
  "appointment_booked",
  "do_not_call",
  "follow_up_requested",
  "transferred",
  "escalation_required",
] as const
export type VoiceCallDisposition = (typeof VOICE_CALL_DISPOSITIONS)[number]

export const VOICE_NUMBER_STATUSES = ["pending", "active", "released", "suspended"] as const
export type VoiceNumberStatus = (typeof VOICE_NUMBER_STATUSES)[number]

export const VOICE_PROVIDER_CONFIG_STATUSES = ["pending", "ready", "degraded", "disabled"] as const
export type VoiceProviderConfigStatus = (typeof VOICE_PROVIDER_CONFIG_STATUSES)[number]

export const VOICE_TRANSCRIPTION_STATUSES = ["pending", "processing", "completed", "failed", "unavailable"] as const
export type VoiceTranscriptionStatus = (typeof VOICE_TRANSCRIPTION_STATUSES)[number]

export const VOICE_CONVERSATION_STATUSES = ["active", "closed", "archived"] as const
export type VoiceConversationStatus = (typeof VOICE_CONVERSATION_STATUSES)[number]

export const VOICE_ROUTING_MODES = [
  "forward_to_number",
  "assigned_user",
  "round_robin",
  "simultaneous_ring",
  "voicemail_only",
  "ai_receptionist_future",
] as const
export type VoiceRoutingMode = (typeof VOICE_ROUTING_MODES)[number]

export const VOICE_BUSINESS_HOURS_STATUSES = ["open", "closed", "holiday", "unknown"] as const
export type VoiceBusinessHoursStatus = (typeof VOICE_BUSINESS_HOURS_STATUSES)[number]

export const VOICE_ROUTING_MODE_LABELS: Record<VoiceRoutingMode, string> = {
  forward_to_number: "Forward to number",
  assigned_user: "Assigned user",
  round_robin: "Round robin",
  simultaneous_ring: "Simultaneous ring",
  voicemail_only: "Voicemail only",
  ai_receptionist_future: "AI receptionist (future — disabled)",
}

export const VOICE_PROVIDER_LABELS: Record<VoiceProviderId, string> = {
  twilio: "Twilio",
  telnyx: "Telnyx",
  plivo: "Plivo",
  sip: "SIP",
  stub: "Stub (development)",
}

export type VoiceNumberRecord = {
  id: string
  organizationId: string
  provider: VoiceProviderId
  providerNumberId: string
  phoneNumber: string
  displayName: string
  capabilitiesJson: Record<string, unknown>
  status: VoiceNumberStatus
  smsEnabled: boolean
  voiceEnabled: boolean
  assignedUserId: string | null
  routingProfileId: string | null
  routingMode: VoiceRoutingMode | null
  defaultForwardingTarget: string
  recordingPolicy: VoiceRecordingPolicy | null
  metadataJson: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceCallRecord = {
  id: string
  organizationId: string
  provider: VoiceProviderId
  providerCallId: string
  direction: VoiceCallDirection
  status: VoiceCallStatus
  fromNumber: string
  toNumber: string
  startedAt: string | null
  answeredAt: string | null
  endedAt: string | null
  durationSeconds: number
  recordingAvailable: boolean
  transcriptionAvailable: boolean
  transferred: boolean
  transferredTo: string | null
  assignedUserId: string | null
  voiceConversationId: string | null
  relatedCustomerId: string | null
  relatedProspectId: string | null
  relatedOpportunityId: string | null
  operatorDisposition: VoiceCallDisposition | null
  costCurrency: string
  costAmount: number | null
  metadataJson: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceProviderConfigurationRecord = {
  id: string
  organizationId: string
  provider: VoiceProviderId
  providerAccountReference: string
  status: VoiceProviderConfigStatus
  voiceEnabled: boolean
  smsEnabled: boolean
  webhookValidated: boolean
  lastValidationAt: string | null
  metadataJson: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceInfrastructureReadinessSnapshot = {
  qaMarker: typeof VOICE_FOUNDATION_QA_MARKER
  organizationId: string | null
  configuredProviders: VoiceProviderConfigurationRecord[]
  phoneNumberCount: number
  webhookValidationSummary: {
    validatedCount: number
    pendingCount: number
  }
  complianceReadiness: {
    optOutCount: number
    message: string
  }
  infrastructureMessage: string
}

export type VoiceConversationRecord = {
  id: string
  organizationId: string
  primaryPhoneNumber: string
  contactName: string
  relatedCustomerId: string | null
  relatedProspectId: string | null
  relatedOpportunityId: string | null
  status: VoiceConversationStatus
  lastActivityAt: string
  metadataJson: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceRoutingProfileRecord = {
  id: string
  organizationId: string
  name: string
  description: string
  routingMode: VoiceRoutingMode
  fallbackMode: VoiceRoutingMode
  fallbackPhoneNumber: string
  voicemailBoxId: string | null
  businessHoursId: string | null
  metadataJson: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceRoutingProfileMemberRecord = {
  id: string
  organizationId: string
  routingProfileId: string
  userId: string
  priority: number
  isActive: boolean
  forwardingPhoneNumber: string
  browserClientIdentity?: string | null
  createdAt: string
  updatedAt: string
}

export type VoiceBusinessHoursRecord = {
  id: string
  organizationId: string
  name: string
  timezone: string
  weeklyScheduleJson: Record<string, unknown>
  holidayRulesJson: unknown[]
  afterHoursRoutingMode: VoiceRoutingMode
  afterHoursForwardingNumber: string
  afterHoursVoicemailBoxId: string | null
  createdAt: string
  updatedAt: string
}

export type VoiceVoicemailBoxRecord = {
  id: string
  organizationId: string
  name: string
  greetingText: string
  greetingRecordingPath: string | null
  notificationEmail: string
  assignedUserId: string | null
  retentionDays: number
  createdAt: string
  updatedAt: string
}

export type VoiceNumberListItem = VoiceNumberRecord & {
  routingModeLabel: string
  businessHoursStatus: VoiceBusinessHoursStatus
  businessHoursStatusLabel: string
}

export type VoiceComplianceReadinessSnapshot = {
  optOutTableReady: boolean
  optOutCount: number
  dncEnforcementMessage: string
  callRecordingDisclosureMessage: string
  aiDisclosureMessage: string
}

export type VoiceOperationsReadinessSnapshot = VoiceInfrastructureReadinessSnapshot & {
  operationsQaMarker: typeof VOICE_OPERATIONS_QA_MARKER
  routingProfileCount: number
  businessHoursCount: number
  voicemailBoxCount: number
  complianceReadinessExtended: VoiceComplianceReadinessSnapshot
  callControlReadiness?: VoiceCallControlReadinessSnapshot
  transferControlReadiness?: VoiceTransferControlReadinessSnapshot
  mediaStreamingReadiness?: VoiceMediaStreamingReadinessSnapshot
}
