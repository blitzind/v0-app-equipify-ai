/** Voice browser calling — Phase 1D shared types (client-safe). */

import type {
  VoiceCallTransferPublicView,
  VoiceConferenceParticipantPublicView,
} from "@/lib/voice/transfer-control/types"
import type { VoiceCallTranscriptSnapshot } from "@/lib/voice/media-streaming/types"
import type { VoiceCallConversationIntelligenceSnapshot } from "@/lib/voice/intelligence/types"
import type { UnifiedOperatorAssistSnapshot } from "@/lib/growth/operator-assist/types"
import type { VoiceRelationshipMemoryWorkspaceSnapshot } from "@/lib/voice/relationship-memory/types"

export const VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER = "voice-native-dialer-integration-v1" as const

export const VOICE_BROWSER_CALL_STATES = [
  "idle",
  "connecting",
  "ringing",
  "active",
  "held",
  "muted",
  "ending",
  "disconnected",
  "failed",
] as const
export type VoiceBrowserCallState = (typeof VOICE_BROWSER_CALL_STATES)[number]

export const VOICE_BROWSER_DEVICE_STATUSES = [
  "registering",
  "available",
  "busy",
  "offline",
  "reconnecting",
] as const
export type VoiceBrowserDeviceStatus = (typeof VOICE_BROWSER_DEVICE_STATUSES)[number]

export const VOICE_OPERATOR_PRESENCE_STATUSES = [
  "offline",
  "online",
  "away",
  "on_call",
  "reconnecting",
] as const
export type VoiceOperatorPresenceStatus = (typeof VOICE_OPERATOR_PRESENCE_STATUSES)[number]

export const VOICE_BROWSER_PROVIDER_IDS = ["twilio", "telnyx", "sip", "stub"] as const
export type VoiceBrowserProviderId = (typeof VOICE_BROWSER_PROVIDER_IDS)[number]

export type VoiceBrowserDevicePublicView = {
  id: string
  clientIdentity: string
  provider: VoiceBrowserProviderId
  status: VoiceBrowserDeviceStatus
  lastRegisteredAt: string
  lastHeartbeatAt: string
  activeVoiceCallId: string | null
}

export type VoiceOperatorPresencePublicView = {
  userId: string
  status: VoiceOperatorPresenceStatus
  activeDeviceCount: number
  activeVoiceCallId: string | null
  activeWorkspaceSessionId: string | null
  lastSeenAt: string
}

export type VoiceCallTimelineEventView = {
  id: string
  eventType: string
  eventTimestamp: string
  label: string
  payloadSummary: string | null
}

export type VoiceCallRecordingVisibilityView = {
  recordingId: string
  recordingKind: string
  durationSeconds: number | null
  retentionExpiresAt: string | null
  transcriptionStatus: string
  playbackAvailable: boolean
  playbackPlaceholder: string
}

export type VoiceBrowserCallingReadinessSnapshot = {
  qaMarker: typeof VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER
  browserCallingReady: boolean
  tokenReadiness: "ready" | "missing_credentials" | "missing_twiml_app" | "stub_only"
  voiceSdkReadiness: "ready" | "missing_credentials" | "stub_only"
  websocketReadiness: "browser_supported" | "unknown"
  microphoneGuidance: string
  browserCompatibilityNote: string
  connectedOperatorCount: number
  activeDeviceCount: number
  warnings: string[]
}

export type VoiceBrowserSyncSnapshot = {
  qaMarker: typeof VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER
  generatedAt: string
  browserCallState: VoiceBrowserCallState
  device: VoiceBrowserDevicePublicView | null
  presence: VoiceOperatorPresencePublicView | null
  activeVoiceCallId: string | null
  workspaceSessionId: string | null
  timeline: VoiceCallTimelineEventView[]
  recording: VoiceCallRecordingVisibilityView | null
  inboundRinging: VoiceInboundBrowserOfferView | null
  participants: VoiceConferenceParticipantPublicView[]
  activeTransfer: VoiceCallTransferPublicView | null
  liveTranscript: VoiceCallTranscriptSnapshot | null
  conversationIntelligence: VoiceCallConversationIntelligenceSnapshot | null
  operatorAssist: UnifiedOperatorAssistSnapshot | null
  relationshipMemory: VoiceRelationshipMemoryWorkspaceSnapshot | null
}

export type VoiceInboundBrowserOfferView = {
  voiceCallId: string
  workspaceSessionId: string
  fromNumber: string
  toNumber: string
  contactLabel: string | null
  offeredAt: string
}

export type VoiceBrowserTokenResponse = {
  qaMarker: typeof VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER
  provider: VoiceBrowserProviderId
  token: string | null
  clientIdentity: string
  expiresAt: string | null
  stubMode: boolean
  message: string
}
