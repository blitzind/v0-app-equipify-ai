/** Voice Call Control — Phase 1C shared types (client-safe). */

export const VOICE_CALL_CONTROL_QA_MARKER = "voice-call-control-v1" as const

export const VOICE_RECORDING_POLICIES = ["disabled", "inbound_only", "outbound_only", "all_calls"] as const
export type VoiceRecordingPolicy = (typeof VOICE_RECORDING_POLICIES)[number]

export const VOICE_RECORDING_POLICY_LABELS: Record<VoiceRecordingPolicy, string> = {
  disabled: "Disabled",
  inbound_only: "Inbound only",
  outbound_only: "Outbound only",
  all_calls: "All calls",
}

export const VOICE_RECORDING_KINDS = ["call", "voicemail"] as const
export type VoiceRecordingKind = (typeof VOICE_RECORDING_KINDS)[number]

export type VoiceCallControlSettingsRecord = {
  organizationId: string
  defaultRecordingPolicy: VoiceRecordingPolicy
  recordingDisclosureText: string
  inboundCallControlReady: boolean
  voicemailCallbackReady: boolean
  metadataJson: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type InboundCallControlDecision = {
  qaMarker: typeof VOICE_CALL_CONTROL_QA_MARKER
  routeStatus: "resolved" | "degraded" | "blocked"
  routingMode: string | null
  action: "forward" | "dial" | "voicemail" | "reject" | "say_and_hangup" | "ai_receptionist"
  dialNumbers: string[]
  dialClientIdentities?: string[]
  voicemailBoxId: string | null
  recordingEnabled: boolean
  recordingDisclosureText: string | null
  fallbackReason: string | null
  warnings: string[]
}

export type VoiceCallControlReadinessSnapshot = {
  qaMarker: typeof VOICE_CALL_CONTROL_QA_MARKER
  inboundWebhookUrl: string
  statusWebhookUrl: string
  recordingCallbackUrl: string
  inboundCallControlReady: boolean
  voicemailCallbackReady: boolean
  defaultRecordingPolicy: VoiceRecordingPolicy
  recordingDisclosureText: string
  recordingDisclosureMessage: string
  callControlMessage: string
}
