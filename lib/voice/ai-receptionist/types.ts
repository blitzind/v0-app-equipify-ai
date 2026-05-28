/** Voice AI Inbound Receptionist — Phase 4A shared types (client-safe). */

export const VOICE_AI_RECEPTIONIST_QA_MARKER = "voice-ai-receptionist-v1" as const

export const VOICE_AI_RECEPTIONIST_AUTONOMOUS_OUTBOUND_DISABLED = true as const
export const VOICE_AI_RECEPTIONIST_AUTONOMOUS_CRM_DISABLED = true as const
export const VOICE_AI_RECEPTIONIST_BOUNDED_CONVERSATION_ONLY = true as const
export const VOICE_AI_RECEPTIONIST_AI_DISCLOSURE_ENABLED = true as const

export const VOICE_AI_RECEPTIONIST_STATUSES = [
  "greeting",
  "qualification",
  "faq",
  "scheduling",
  "transfer_pending",
  "operator_joined",
  "voicemail_capture",
  "completed",
  "failed",
  "escalated",
] as const

export type VoiceAiReceptionistStatus = (typeof VOICE_AI_RECEPTIONIST_STATUSES)[number]

export const VOICE_AI_RECEPTIONIST_CONVERSATION_PHASES = [
  "greeting",
  "intent_detection",
  "qualification",
  "faq",
  "scheduling",
  "escalation",
  "transfer",
  "voicemail",
  "completed",
] as const

export type VoiceAiReceptionistConversationPhase =
  (typeof VOICE_AI_RECEPTIONIST_CONVERSATION_PHASES)[number]

export const VOICE_AI_RECEPTIONIST_EVENT_TYPES = [
  "ai_response_generated",
  "caller_intent_detected",
  "qualification_answer",
  "faq_answered",
  "escalation_detected",
  "transfer_requested",
  "operator_joined",
  "interruption_detected",
  "fallback_triggered",
  "voicemail_requested",
  "scheduling_requested",
  "receptionist_failed",
  "missed_call_recovery_prepared",
  "operator_takeover",
  "session_started",
  "session_ended",
] as const

export type VoiceAiReceptionistEventType = (typeof VOICE_AI_RECEPTIONIST_EVENT_TYPES)[number]

export const VOICE_AI_RECEPTIONIST_PROVIDERS = [
  "deterministic",
  "deepgram",
  "openai_realtime",
  "elevenlabs",
  "stub",
] as const

export type VoiceAiReceptionistProviderId = (typeof VOICE_AI_RECEPTIONIST_PROVIDERS)[number]

export const VOICE_AI_RECEPTIONIST_ESCALATION_RISK_LEVELS = [
  "low",
  "moderate",
  "elevated",
  "critical",
] as const

export type VoiceAiReceptionistEscalationRiskLevel =
  (typeof VOICE_AI_RECEPTIONIST_ESCALATION_RISK_LEVELS)[number]

export const VOICE_AI_RECEPTIONIST_CALLER_INTENTS = [
  "general_inquiry",
  "service_request",
  "appointment_request",
  "billing_question",
  "speak_to_human",
  "emergency",
  "unknown",
] as const

export type VoiceAiReceptionistCallerIntent = (typeof VOICE_AI_RECEPTIONIST_CALLER_INTENTS)[number]

export const VOICE_AI_RECEPTIONIST_PROVIDER_TIMEOUT_MS = 1_500 as const
export const VOICE_AI_RECEPTIONIST_MAX_TURN_SECONDS = 45 as const
export const VOICE_AI_RECEPTIONIST_TRANSCRIPT_WINDOW_SEGMENTS = 12 as const
export const VOICE_AI_RECEPTIONIST_MAX_ACTIVE_SESSIONS_PER_ORG = 8 as const
export const VOICE_AI_RECEPTIONIST_STALE_SESSION_MINUTES = 30 as const
export const VOICE_AI_RECEPTIONIST_LATENCY_TARGET_MS = 1_500 as const

export const VOICE_AI_RECEPTIONIST_PROHIBITED_TOPICS = [
  "legal_advice",
  "medical_advice",
  "pricing_commitment",
  "contract_negotiation",
  "competitor_disparagement",
] as const

export type VoiceAiReceptionistFaqEntryPublicView = {
  id: string
  organizationId: string
  topic: string
  questionPattern: string
  approvedAnswer: string
  escalationRequired: boolean
  blocked: boolean
  sortOrder: number
}

export type VoiceAiReceptionistQualificationStep = {
  key: string
  prompt: string
  required: boolean
  escalationOnMissing?: boolean
}

export type VoiceAiReceptionistQualificationFlowPublicView = {
  id: string
  organizationId: string
  flowKey: string
  label: string
  steps: VoiceAiReceptionistQualificationStep[]
  escalationTriggers: string[]
  isActive: boolean
}

export type VoiceAiReceptionistEventPublicView = {
  id: string
  organizationId: string
  sessionId: string
  voiceCallId: string
  eventType: VoiceAiReceptionistEventType
  evidenceText: string
  transcriptSegmentId: string | null
  providerSource: VoiceAiReceptionistProviderId | null
  payload: Record<string, unknown>
  createdAt: string
}

export type VoiceAiReceptionistSessionPublicView = {
  id: string
  organizationId: string
  voiceCallId: string
  voiceConferenceId: string | null
  relationshipMemoryProfileId: string | null
  receptionistStatus: VoiceAiReceptionistStatus
  currentConversationPhase: VoiceAiReceptionistConversationPhase
  escalationRiskLevel: VoiceAiReceptionistEscalationRiskLevel
  activeOperatorId: string | null
  aiProvider: VoiceAiReceptionistProviderId
  transcriptSessionId: string | null
  mediaSessionId: string | null
  qualificationState: Record<string, unknown>
  handoffSummaryDraft: string | null
  latencyMsLast: number | null
  startedAt: string
  endedAt: string | null
  metadata: Record<string, unknown>
}

export type VoiceAiReceptionistWorkspaceSnapshot = {
  qaMarker: typeof VOICE_AI_RECEPTIONIST_QA_MARKER
  voiceCallId: string
  generatedAt: string
  session: VoiceAiReceptionistSessionPublicView | null
  recentEvents: VoiceAiReceptionistEventPublicView[]
  currentIntent: VoiceAiReceptionistCallerIntent | null
  qualificationProgress: { completed: number; total: number; currentStep: string | null }
  operatorTakeoverAvailable: boolean
  autonomousOutboundDisabled: true
  autonomousCrmDisabled: true
  boundedConversationOnly: true
  message: string
}

export type VoiceAiReceptionistReadinessSnapshot = {
  qaMarker: typeof VOICE_AI_RECEPTIONIST_QA_MARKER
  schemaReady: boolean
  receptionistEnabled: boolean
  providerMode: VoiceAiReceptionistProviderId
  realtimeAudioReady: boolean
  faqReady: boolean
  qualificationFlowReady: boolean
  escalationRoutingReady: boolean
  operatorTakeoverReady: boolean
  guardrailsEnabled: boolean
  autonomousOutboundDisabled: true
  aiDisclosureEnabled: boolean
  activeSessionCount: number
  maxActiveSessions: number
  latencyTargetMs: number
  message: string
}
