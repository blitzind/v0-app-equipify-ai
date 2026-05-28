/** Unified multi-channel communications intelligence — Phase 6A (client-safe). */

export const VOICE_MULTICHANNEL_INTELLIGENCE_QA_MARKER = "voice-multichannel-intelligence-v1" as const

export const VOICE_MULTICHANNEL_AUTONOMOUS_OMNICHANNEL_DISABLED = true as const
export const VOICE_MULTICHANNEL_AUTO_CHANNEL_SWITCH_DISABLED = true as const
export const VOICE_MULTICHANNEL_AUTO_SEND_DISABLED = true as const
export const VOICE_MULTICHANNEL_HIDDEN_SCORING_DISABLED = true as const

export const VOICE_UNIFIED_COMMUNICATION_THREAD_TYPES = [
  "support",
  "sales",
  "retention",
  "scheduling",
  "escalation",
  "onboarding",
  "followup",
  "unresolved_issue",
] as const

export type VoiceUnifiedCommunicationThreadType = (typeof VOICE_UNIFIED_COMMUNICATION_THREAD_TYPES)[number]

export const VOICE_UNIFIED_COMMUNICATION_THREAD_STATES = [
  "active",
  "awaiting_customer",
  "awaiting_operator",
  "escalated",
  "stalled",
  "resolved",
  "archived",
] as const

export type VoiceUnifiedCommunicationThreadState = (typeof VOICE_UNIFIED_COMMUNICATION_THREAD_STATES)[number]

export const VOICE_UNIFIED_COMMUNICATION_CHANNELS = [
  "voice",
  "voicemail",
  "callback",
  "ai_receptionist",
  "outbound_ai",
  "scheduling",
  "sms",
  "email",
  "portal",
] as const

export type VoiceUnifiedCommunicationChannel = (typeof VOICE_UNIFIED_COMMUNICATION_CHANNELS)[number]

export const VOICE_UNIFIED_COMMUNICATION_EVENT_TYPES = [
  "voice_call_completed",
  "voicemail_left",
  "ai_receptionist_interaction",
  "outbound_ai_completed",
  "callback_completed",
  "escalation_triggered",
  "operator_takeover",
  "followup_recommended",
  "communication_failed",
  "channel_transition",
  "unresolved_issue_detected",
  "scheduling_requested",
  "scheduling_completed",
  "opt_out_detected",
  "communication_resolved",
  "sms_event_recorded",
  "email_event_recorded",
  "portal_message_recorded",
] as const

export type VoiceUnifiedCommunicationEventType = (typeof VOICE_UNIFIED_COMMUNICATION_EVENT_TYPES)[number]

export const VOICE_MULTICHANNEL_RETENTION_DAYS = 90 as const
export const VOICE_MULTICHANNEL_MAX_TIMELINE_EVENTS = 50 as const
export const VOICE_MULTICHANNEL_MAX_ACTIVE_THREADS = 200 as const
export const VOICE_MULTICHANNEL_SNAPSHOT_CACHE_MINUTES = 5 as const
export const VOICE_MULTICHANNEL_STALE_HOURS = 72 as const
export const VOICE_MULTICHANNEL_FATIGUE_CONTACT_THRESHOLD = 5 as const

export type VoiceUnifiedCommunicationThreadPublicView = {
  id: string
  organizationId: string
  threadType: VoiceUnifiedCommunicationThreadType
  relationshipMemoryProfileId: string | null
  relatedCustomerId: string | null
  relatedProspectId: string | null
  relatedOpportunityId: string | null
  primaryChannel: VoiceUnifiedCommunicationChannel
  currentState: VoiceUnifiedCommunicationThreadState
  escalationState: string | null
  lastChannelUsed: VoiceUnifiedCommunicationChannel | null
  preferredChannel: VoiceUnifiedCommunicationChannel | null
  communicationSummary: string
  unresolvedIssueCount: number
  lastInteractionAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceUnifiedCommunicationEventPublicView = {
  id: string
  organizationId: string
  threadId: string
  eventType: VoiceUnifiedCommunicationEventType
  channel: VoiceUnifiedCommunicationChannel
  sourceSystem: string
  evidenceText: string
  sourceSessionId: string | null
  sourceCallId: string | null
  payload: Record<string, unknown>
  createdBy: string | null
  createdAt: string
}

export type VoicePreferredChannelInsight = {
  channel: VoiceUnifiedCommunicationChannel
  reason: string
  confidence: "low" | "medium" | "high"
  evidenceCount: number
  operatorOverrideAllowed: true
  hiddenScoringDisabled: true
}

export type VoiceCommunicationHealthSummary = {
  fatigueCount: number
  excessiveContactAttempts: number
  unresolvedChainCount: number
  repeatedEscalationCount: number
  voicemailFailureCount: number
  unansweredCallbackCount: number
  responseDelayCount: number
  channelAbandonmentCount: number
  relationshipCommunicationRisk: "low" | "medium" | "high"
  engagementContinuityScore: number
}

export type VoiceMultichannelRecommendation = {
  action: string
  evidence: string
  channel?: VoiceUnifiedCommunicationChannel | null
  requiresOperatorReview: true
  autonomousExecutionDisabled: true
}

export type VoiceMultichannelIntelligenceWorkspaceSnapshot = {
  qaMarker: typeof VOICE_MULTICHANNEL_INTELLIGENCE_QA_MARKER
  generatedAt: string
  activeThreads: VoiceUnifiedCommunicationThreadPublicView[]
  recentEvents: VoiceUnifiedCommunicationEventPublicView[]
  preferredChannelInsights: VoicePreferredChannelInsight[]
  health: VoiceCommunicationHealthSummary
  recommendations: VoiceMultichannelRecommendation[]
  autonomousOmnichannelDisabled: true
  message: string
}

export type VoiceMultichannelIntelligenceCommandSummary = {
  qaMarker: typeof VOICE_MULTICHANNEL_INTELLIGENCE_QA_MARKER
  activeThreadCount: number
  escalatedCount: number
  stalledCount: number
  unresolvedIssueCount: number
  fatigueWarningCount: number
  message: string
}

export type VoiceMultichannelIntelligenceReadinessSnapshot = {
  qaMarker: typeof VOICE_MULTICHANNEL_INTELLIGENCE_QA_MARKER
  schemaReady: boolean
  intelligenceEnabled: boolean
  unifiedTimelineReady: boolean
  crossChannelCoordinationReady: boolean
  escalationContinuityReady: boolean
  communicationHealthReady: boolean
  preferredChannelIntelligenceReady: boolean
  workflowIntegrationReady: boolean
  observabilityIntegrationReady: boolean
  futureChannelHooksReady: boolean
  autonomousOmnichannelDisabled: true
  message: string
}

export type VoiceCommunicationTimelineEntry = {
  eventType: string
  channel: string
  evidenceText: string
  sourceSystem: string
  createdAt: string
}

export type VoiceChannelTransitionRecord = {
  fromChannel: VoiceUnifiedCommunicationChannel | null
  toChannel: VoiceUnifiedCommunicationChannel
  success: boolean
  evidence: string
  timestamp: string
}
