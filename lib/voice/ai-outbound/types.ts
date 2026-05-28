/** Voice AI Outbound — Phase 5A shared types (client-safe). */

export const VOICE_AI_OUTBOUND_QA_MARKER = "voice-ai-outbound-v1" as const

export const VOICE_AI_OUTBOUND_AUTONOMOUS_OUTBOUND_DISABLED = true as const
export const VOICE_AI_OUTBOUND_AUTONOMOUS_COLD_CALLING_DISABLED = true as const
export const VOICE_AI_OUTBOUND_APPROVAL_REQUIRED = true as const
export const VOICE_AI_OUTBOUND_BOUNDED_CONVERSATION_ONLY = true as const

export const VOICE_AI_OUTBOUND_WORKFLOW_TYPES = [
  "missed_call_callback",
  "voicemail_followup",
  "appointment_confirmation",
  "appointment_reminder",
  "qualification_callback",
  "after_hours_followup",
  "warm_reengagement",
  "operator_assisted_callback",
] as const

export type VoiceAiOutboundWorkflowType = (typeof VOICE_AI_OUTBOUND_WORKFLOW_TYPES)[number]

export const VOICE_AI_OUTBOUND_SESSION_STATUSES = [
  "queued",
  "pending_operator_approval",
  "initiating",
  "active",
  "escalation_pending",
  "operator_joined",
  "voicemail_mode",
  "completed",
  "failed",
  "blocked_by_compliance",
  "canceled",
] as const

export type VoiceAiOutboundSessionStatus = (typeof VOICE_AI_OUTBOUND_SESSION_STATUSES)[number]

export const VOICE_AI_OUTBOUND_ESCALATION_STATES = [
  "none",
  "pending",
  "operator_requested",
  "transfer_in_progress",
  "resolved",
] as const

export type VoiceAiOutboundEscalationState = (typeof VOICE_AI_OUTBOUND_ESCALATION_STATES)[number]

export const VOICE_AI_OUTBOUND_SUPERVISION_MODES = [
  "approval_required",
  "operator_supervised",
  "operator_joined",
] as const

export type VoiceAiOutboundSupervisionMode = (typeof VOICE_AI_OUTBOUND_SUPERVISION_MODES)[number]

export const VOICE_AI_OUTBOUND_EVENT_TYPES = [
  "compliance_passed",
  "compliance_blocked",
  "operator_approved",
  "outbound_started",
  "voicemail_detected",
  "ai_response_generated",
  "escalation_triggered",
  "transfer_requested",
  "operator_joined",
  "scheduling_requested",
  "qualification_completed",
  "callback_requested",
  "opt_out_detected",
  "conversation_terminated",
  "outbound_failed",
  "session_queued",
  "session_canceled",
  "provider_fallback",
  "silence_handled",
  "interruption_detected",
] as const

export type VoiceAiOutboundEventType = (typeof VOICE_AI_OUTBOUND_EVENT_TYPES)[number]

export const VOICE_AI_OUTBOUND_PROVIDERS = [
  "deterministic",
  "deepgram",
  "openai_realtime",
  "elevenlabs",
  "stub",
] as const

export type VoiceAiOutboundProviderId = (typeof VOICE_AI_OUTBOUND_PROVIDERS)[number]

export const VOICE_AI_OUTBOUND_CONVERSATION_PHASES = [
  "approval_pending",
  "opening",
  "qualification",
  "scheduling",
  "voicemail",
  "escalation",
  "callback_offer",
  "closing",
  "terminated",
] as const

export type VoiceAiOutboundConversationPhase = (typeof VOICE_AI_OUTBOUND_CONVERSATION_PHASES)[number]

export const VOICE_AI_OUTBOUND_PROHIBITED_TOPICS = [
  "legal_advice",
  "medical_advice",
  "pricing_commitment",
  "contract_negotiation",
  "aggressive_pressure",
] as const

export const VOICE_AI_OUTBOUND_PROVIDER_TIMEOUT_MS = 2_000 as const
export const VOICE_AI_OUTBOUND_MAX_RESPONSE_CHARS = 450 as const
export const VOICE_AI_OUTBOUND_MAX_ACTIVE_SESSIONS_PER_ORG = 4 as const
export const VOICE_AI_OUTBOUND_MAX_CONCURRENT_INITIATIONS = 2 as const
export const VOICE_AI_OUTBOUND_MAX_RETRY_ATTEMPTS = 2 as const
export const VOICE_AI_OUTBOUND_STALE_SESSION_MINUTES = 45 as const
export const VOICE_AI_OUTBOUND_TRANSCRIPT_WINDOW_SEGMENTS = 10 as const
export const VOICE_AI_OUTBOUND_ESCALATION_CONFUSION_THRESHOLD = 3 as const
export const VOICE_AI_OUTBOUND_ESCALATION_FRUSTRATION_THRESHOLD = 2 as const

export type VoiceAiOutboundSessionPublicView = {
  id: string
  organizationId: string
  relatedCustomerId: string | null
  relatedProspectId: string | null
  relationshipMemoryProfileId: string | null
  sourceRecoveryEventId: string | null
  sourceCampaignId: string | null
  voiceCallId: string | null
  phoneNumber: string
  outboundSessionStatus: VoiceAiOutboundSessionStatus
  outboundWorkflowType: VoiceAiOutboundWorkflowType
  aiProvider: VoiceAiOutboundProviderId
  escalationState: VoiceAiOutboundEscalationState
  operatorSupervisionMode: VoiceAiOutboundSupervisionMode
  transcriptSessionId: string | null
  complianceDecision: string | null
  complianceReasons: string[]
  manualReviewRequired: boolean
  messagePreview: string | null
  approvedBy: string | null
  approvedAt: string | null
  startedAt: string | null
  endedAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceAiOutboundEventPublicView = {
  id: string
  organizationId: string
  sessionId: string
  voiceCallId: string | null
  eventType: VoiceAiOutboundEventType
  evidenceText: string
  transcriptSegmentId: string | null
  providerSource: VoiceAiOutboundProviderId | null
  payload: Record<string, unknown>
  createdBy: string | null
  createdAt: string
}

export type VoiceAiOutboundReadinessSnapshot = {
  qaMarker: typeof VOICE_AI_OUTBOUND_QA_MARKER
  schemaReady: boolean
  outboundEnabled: boolean
  providerMode: VoiceAiOutboundProviderId
  complianceReadiness: boolean
  consentReadiness: boolean
  operatorApprovalReady: boolean
  escalationRoutingReady: boolean
  voicemailReadiness: boolean
  providerReady: boolean
  fallbackReady: boolean
  activeSessionCount: number
  pendingApprovalCount: number
  maxActiveSessions: number
  maxConcurrentInitiations: number
  autonomousOutboundDisabled: true
  autonomousColdCallingDisabled: true
  approvalRequired: true
  message: string
}

export type VoiceAiOutboundApprovalQueueSnapshot = {
  qaMarker: typeof VOICE_AI_OUTBOUND_QA_MARKER
  generatedAt: string
  pendingSessions: VoiceAiOutboundSessionPublicView[]
  blockedCount: number
  pendingApprovalCount: number
  message: string
}

export type VoiceAiOutboundWorkspaceSnapshot = {
  qaMarker: typeof VOICE_AI_OUTBOUND_QA_MARKER
  generatedAt: string
  activeSessions: VoiceAiOutboundSessionPublicView[]
  recentEvents: VoiceAiOutboundEventPublicView[]
  pendingApprovalCount: number
  autonomousOutboundDisabled: true
  approvalRequired: true
  message: string
}

export type OutboundApprovalAction = "approve" | "reject" | "cancel" | "schedule"
