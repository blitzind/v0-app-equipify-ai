/** Client-safe native dialer + unified call workspace types (slice 6.34A). */

export const GROWTH_NATIVE_DIALER_QA_MARKER = "native-dialer-v1" as const
export const GROWTH_NATIVE_DIALER_LAYOUT_QA_MARKER = "native-dialer-layout-v3" as const
export const GROWTH_NATIVE_DIALER_CALL_START_FIX_QA_MARKER = "native-dialer-call-start-fix-v1" as const
export const GROWTH_NATIVE_DIALER_LIVE_COACHING_CENTER_QA_MARKER = "native-dialer-live-coaching-center-v1" as const
export const GROWTH_GOOGLE_VOICE_BRIDGE_QA_MARKER = "google-voice-bridge-manual-flow-v2" as const

export const NATIVE_DIALER_PROVIDER_IDS = [
  "stub",
  "retell",
  "twilio",
  "elevenlabs_conversational",
  "sip",
  "google_voice_bridge",
] as const
export type NativeDialerProviderId = (typeof NATIVE_DIALER_PROVIDER_IDS)[number]

export const NATIVE_DIALER_PROVIDER_LABELS: Record<NativeDialerProviderId, string> = {
  stub: "Stub (operator simulated)",
  retell: "Retell",
  twilio: "Twilio",
  elevenlabs_conversational: "ElevenLabs Conversational",
  sip: "SIP / Custom",
  google_voice_bridge: "Google Voice Bridge",
}

export const NATIVE_DIALER_QUEUE_MODES = [
  "manual",
  "preview",
  "power",
  "callback",
  "missed_callback",
  "priority",
] as const
export type NativeDialerQueueMode = (typeof NATIVE_DIALER_QUEUE_MODES)[number]

export const NATIVE_DIALER_QUEUE_MODE_LABELS: Record<NativeDialerQueueMode, string> = {
  manual: "Manual dial",
  preview: "Preview dial",
  power: "Power dial",
  callback: "Call back queue",
  missed_callback: "Missed callback queue",
  priority: "Priority queue",
}

export const NATIVE_CALL_SESSION_STATUSES = [
  "ringing",
  "external_bridge_pending",
  "active",
  "on_hold",
  "wrapping",
  "completed",
  "failed",
  "missed",
  "no_answer",
] as const
export type NativeCallSessionStatus = (typeof NATIVE_CALL_SESSION_STATUSES)[number]

export const NATIVE_CALL_WRAPUP_OUTCOMES = [
  "connected",
  "left_voicemail",
  "no_answer",
  "meeting_booked",
  "follow_up_needed",
  "not_interested",
  "wrong_number",
] as const
export type NativeCallWrapupOutcome = (typeof NATIVE_CALL_WRAPUP_OUTCOMES)[number]

export const NATIVE_CALL_WRAPUP_OUTCOME_LABELS: Record<NativeCallWrapupOutcome, string> = {
  connected: "Connected",
  left_voicemail: "Left voicemail",
  no_answer: "No answer",
  meeting_booked: "Meeting booked",
  follow_up_needed: "Follow up needed",
  not_interested: "Not interested",
  wrong_number: "Wrong number",
}

export const NATIVE_CALL_RECORDING_STATES = ["none", "pending", "active", "paused", "stopped"] as const
export type NativeCallRecordingState = (typeof NATIVE_CALL_RECORDING_STATES)[number]

export type NativeCallWorkspaceSessionPublicView = {
  id: string
  leadId: string | null
  ownerUserId: string | null
  provider: NativeDialerProviderId
  fallbackProvider: NativeDialerProviderId | null
  dialMode: NativeDialerQueueMode | "inbound"
  direction: "outbound" | "inbound"
  status: NativeCallSessionStatus
  phoneNumber: string | null
  contactName: string | null
  companyName: string | null
  startedAt: string
  connectedAt: string | null
  endedAt: string | null
  durationSeconds: number
  recordingState: NativeCallRecordingState
  muted: boolean
  onHold: boolean
  transferTarget: string | null
  notesDraft: string
  realtimeSessionId: string | null
  callCopilotSessionId: string | null
  providerCallRef: string | null
  safeSummary: string
}

export type NativeDialerQueueItemPublicView = {
  id: string
  leadId: string
  ownerUserId: string | null
  queueMode: NativeDialerQueueMode
  status: string
  priorityScore: number
  callbackDueAt: string | null
  phoneNumber: string | null
  contactName: string | null
  companyName: string | null
  reason: string
  ctaHref: string
}

export type NativeCallWrapupPublicView = {
  id: string
  sessionId: string
  leadId: string | null
  outcome: NativeCallWrapupOutcome
  leftVoicemail: boolean
  noAnswer: boolean
  connected: boolean
  meetingBooked: boolean
  followUpNeeded: boolean
  objectionCategory: string | null
  buyingSignals: string[]
  competitorMentioned: boolean
  timelineDetected: boolean
  budgetDetected: boolean
  championIdentified: boolean
  decisionMakerPresent: boolean
  suggestedNextActions: string[]
  notes: string
  operatorConfirmedAt: string | null
}

export type NativeCallWorkspaceDashboard = {
  qaMarker: typeof GROWTH_NATIVE_DIALER_QA_MARKER
  generatedAt: string
  metrics: {
    callsToday: number
    connectionRate: number
    meetingRate: number
    avgTalkTimeSeconds: number
    objectionTrendCount: number
    callQualityTrend: number
    meetingConversionRate: number
    followUpCompletionRate: number
    queueThroughput: number
  }
  activeSession: NativeCallWorkspaceSessionPublicView | null
  recentSessions: NativeCallWorkspaceSessionPublicView[]
  queuePreview: NativeDialerQueueItemPublicView[]
  primaryProvider: NativeDialerProviderId
  fallbackProvider: NativeDialerProviderId
}

export type NativeDialerLeadContext = {
  leadId: string
  companyName: string
  contactName: string | null
  contactPhone: string | null
  researchSummary: string | null
  dealCloseProbability: number | null
  executionReadinessScore: number | null
  meetingOutcomeScore: number | null
  recommendedNextAction: string | null
  opportunityHealth: string | null
  openTaskCount: number
}

/** Provider orchestration never triggers autonomous outbound or CRM movement. */
export const NATIVE_DIALER_AUTONOMOUS_ACTIONS: string[] = []
