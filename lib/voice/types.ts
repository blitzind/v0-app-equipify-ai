/** Voice Infrastructure Foundation — Phase 1A shared types (client-safe). */

export const VOICE_FOUNDATION_QA_MARKER = "voice-foundation-v1" as const
export const VOICE_PROVIDER_ABSTRACTION_QA_MARKER = "voice-provider-abstraction-v1" as const
export const VOICE_WEBHOOK_INGESTION_QA_MARKER = "voice-webhook-ingestion-v1" as const

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
