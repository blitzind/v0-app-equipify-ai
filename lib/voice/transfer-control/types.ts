/** Voice transfer + multi-party call control — Phase 1E shared types (client-safe). */

export const VOICE_TRANSFER_CONTROL_QA_MARKER = "voice-transfer-control-v1" as const

export const VOICE_CALL_LEG_TYPES = [
  "inbound",
  "outbound",
  "browser_client",
  "pstn",
  "supervisor",
  "ai_future",
] as const
export type VoiceCallLegType = (typeof VOICE_CALL_LEG_TYPES)[number]

export const VOICE_CALL_LEG_STATUSES = [
  "queued",
  "ringing",
  "in_progress",
  "held",
  "completed",
  "failed",
  "canceled",
] as const
export type VoiceCallLegStatus = (typeof VOICE_CALL_LEG_STATUSES)[number]

export const VOICE_CONFERENCE_STATUSES = ["initiated", "in_progress", "completed", "failed"] as const
export type VoiceConferenceStatus = (typeof VOICE_CONFERENCE_STATUSES)[number]

export const VOICE_CONFERENCE_PARTICIPANT_STATUSES = [
  "queued",
  "connecting",
  "connected",
  "held",
  "muted",
  "disconnected",
  "failed",
] as const
export type VoiceConferenceParticipantStatus = (typeof VOICE_CONFERENCE_PARTICIPANT_STATUSES)[number]

export const VOICE_CONFERENCE_PARTICIPANT_ROLES = [
  "operator",
  "supervisor",
  "transfer_target",
  "customer",
  "consult",
] as const
export type VoiceConferenceParticipantRole = (typeof VOICE_CONFERENCE_PARTICIPANT_ROLES)[number]

export const VOICE_TRANSFER_KINDS = ["cold", "warm", "consult"] as const
export type VoiceTransferKind = (typeof VOICE_TRANSFER_KINDS)[number]

export const VOICE_TRANSFER_STATUSES = [
  "idle",
  "starting",
  "consulting",
  "completing",
  "completed",
  "canceled",
  "failed",
  "returned",
] as const
export type VoiceTransferStatus = (typeof VOICE_TRANSFER_STATUSES)[number]

export const VOICE_TRANSFER_CANCEL_ACTIONS = [
  "cancel",
  "return_to_operator",
  "send_to_voicemail",
] as const
export type VoiceTransferCancelAction = (typeof VOICE_TRANSFER_CANCEL_ACTIONS)[number]

export const VOICE_TRANSFER_TIMELINE_EVENT_TYPES = [
  "transfer_started",
  "transfer_canceled",
  "transfer_completed",
  "participant_joined",
  "participant_left",
  "participant_held",
  "participant_resumed",
  "participant_muted",
  "participant_unmuted",
  "supervisor_joined",
] as const
export type VoiceTransferTimelineEventType = (typeof VOICE_TRANSFER_TIMELINE_EVENT_TYPES)[number]

export type VoiceCallLegRecord = {
  id: string
  organizationId: string
  voiceCallId: string
  provider: string
  providerCallSid: string
  legType: VoiceCallLegType
  participantUserId: string | null
  phoneNumber: string
  clientIdentity: string
  status: VoiceCallLegStatus
  startedAt: string | null
  answeredAt: string | null
  endedAt: string | null
  metadataJson: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceConferenceRecord = {
  id: string
  organizationId: string
  voiceCallId: string
  provider: string
  providerConferenceSid: string
  friendlyName: string
  status: VoiceConferenceStatus
  startedAt: string | null
  endedAt: string | null
  metadataJson: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceConferenceParticipantRecord = {
  id: string
  organizationId: string
  conferenceId: string
  voiceCallId: string
  callLegId: string | null
  participantUserId: string | null
  providerParticipantSid: string
  participantRole: VoiceConferenceParticipantRole
  phoneNumber: string
  clientIdentity: string
  status: VoiceConferenceParticipantStatus
  isMuted: boolean
  isOnHold: boolean
  joinedAt: string | null
  leftAt: string | null
  metadataJson: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceCallTransferRecord = {
  id: string
  organizationId: string
  voiceCallId: string
  initiatedByUserId: string
  transferKind: VoiceTransferKind
  status: VoiceTransferStatus
  targetPhoneNumber: string
  targetUserId: string | null
  targetClientIdentity: string
  consultConferenceId: string | null
  completedAt: string | null
  canceledAt: string | null
  metadataJson: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceConferenceParticipantPublicView = {
  id: string
  participantRole: VoiceConferenceParticipantRole
  participantUserId: string | null
  phoneNumber: string
  clientIdentity: string
  status: VoiceConferenceParticipantStatus
  isMuted: boolean
  isOnHold: boolean
  joinedAt: string | null
  label: string
}

export type VoiceCallTransferPublicView = {
  id: string
  transferKind: VoiceTransferKind
  status: VoiceTransferStatus
  targetPhoneNumber: string
  targetClientIdentity: string
  initiatedByUserId: string
}

export type VoiceTransferControlReadinessSnapshot = {
  qaMarker: typeof VOICE_TRANSFER_CONTROL_QA_MARKER
  multiPartyCallControlReady: boolean
  transferReadiness: "ready" | "missing_credentials" | "schema_pending" | "stub_only"
  supervisorJoinReadiness: "ready" | "missing_credentials" | "schema_pending" | "stub_only"
  providerConferenceCapability: "twilio_conference" | "stub" | "unsupported"
  message: string
  warnings: string[]
}

export type VoiceCallControlActionResult = {
  ok: boolean
  qaMarker: typeof VOICE_TRANSFER_CONTROL_QA_MARKER
  message: string
  voiceCallId: string
  transfer?: VoiceCallTransferPublicView | null
  participants?: VoiceConferenceParticipantPublicView[]
  timelineEventType?: VoiceTransferTimelineEventType
}
