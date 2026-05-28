/** Missed-call recovery — Phase 4B shared types (client-safe). */

export const VOICE_MISSED_CALL_RECOVERY_QA_MARKER = "voice-missed-call-recovery-v1" as const

export const VOICE_MISSED_CALL_RECOVERY_AUTONOMOUS_OUTBOUND_DISABLED = true as const

export const VOICE_MISSED_CALL_RECOVERY_TYPES = [
  "missed_inbound_call",
  "abandoned_ai_receptionist",
  "voicemail_left",
  "transfer_failed",
  "after_hours_call",
  "no_operator_available",
] as const

export type VoiceMissedCallRecoveryType = (typeof VOICE_MISSED_CALL_RECOVERY_TYPES)[number]

export const VOICE_MISSED_CALL_RECOVERY_STATUSES = [
  "active",
  "acknowledged",
  "dismissed",
  "resolved",
  "expired",
] as const

export type VoiceMissedCallRecoveryStatus = (typeof VOICE_MISSED_CALL_RECOVERY_STATUSES)[number]

export const VOICE_CALLBACK_TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const

export type VoiceCallbackTaskPriority = (typeof VOICE_CALLBACK_TASK_PRIORITIES)[number]

export const VOICE_CALLBACK_TASK_STATUSES = [
  "recommended",
  "assigned",
  "completed",
  "skipped",
  "expired",
] as const

export type VoiceCallbackTaskStatus = (typeof VOICE_CALLBACK_TASK_STATUSES)[number]

export const VOICE_MISSED_CALL_RECOVERY_MAX_ACTIVE_PER_ORG = 50 as const
export const VOICE_MISSED_CALL_RECOVERY_EXPIRE_DAYS = 14 as const

export type VoiceMissedCallRecoveryEventPublicView = {
  id: string
  organizationId: string
  voiceCallId: string | null
  voiceConversationId: string | null
  relationshipMemoryProfileId: string | null
  phoneNumber: string
  callerName: string | null
  recoveryStatus: VoiceMissedCallRecoveryStatus
  recoveryType: VoiceMissedCallRecoveryType
  recommendedAction: string
  evidenceText: string
  createdAt: string
  acknowledgedAt: string | null
  dismissedAt: string | null
  resolvedAt: string | null
  metadata: Record<string, unknown>
}

export type VoiceCallbackTaskPublicView = {
  id: string
  organizationId: string
  recoveryEventId: string | null
  voiceCallId: string | null
  assignedOwnerUserId: string | null
  phoneNumber: string
  contactName: string | null
  priority: VoiceCallbackTaskPriority
  dueAt: string | null
  preferredWindowStart: string | null
  preferredWindowEnd: string | null
  handoffSummary: string | null
  relationshipContext: string | null
  status: VoiceCallbackTaskStatus
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceMissedCallRecoveryWorkspaceSnapshot = {
  qaMarker: typeof VOICE_MISSED_CALL_RECOVERY_QA_MARKER
  voiceCallId: string | null
  generatedAt: string
  activeRecoveries: VoiceMissedCallRecoveryEventPublicView[]
  callbackTasks: VoiceCallbackTaskPublicView[]
  autonomousOutboundDisabled: true
  message: string
}

export type VoiceMissedCallRecoveryReadinessSnapshot = {
  qaMarker: typeof VOICE_MISSED_CALL_RECOVERY_QA_MARKER
  schemaReady: boolean
  recoveryEnabled: boolean
  operatorAssignmentReady: boolean
  callbackWorkflowReady: boolean
  optOutRegistryReady: boolean
  activeRecoveryCount: number
  pendingCallbackCount: number
  autonomousOutboundDisabled: true
  message: string
}

export type VoiceMissedCallRecoveryCommandSummary = {
  qaMarker: typeof VOICE_MISSED_CALL_RECOVERY_QA_MARKER
  activeCount: number
  callbackDueCount: number
  voicemailLeftCount: number
  abandonedReceptionistCount: number
  autonomousOutboundDisabled: true
}
