/** Voice passive conversation intelligence — Phase 2A shared types (client-safe). */

export const VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER = "voice-conversation-intelligence-v1" as const

export const VOICE_INTELLIGENCE_ANALYSIS_PROVIDERS = ["deterministic_rules", "openai", "stub"] as const
export type VoiceIntelligenceAnalysisProvider = (typeof VOICE_INTELLIGENCE_ANALYSIS_PROVIDERS)[number]

export const VOICE_INTELLIGENCE_EVENT_STATUSES = ["detected", "operator_acknowledged", "dismissed"] as const
export type VoiceIntelligenceEventStatus = (typeof VOICE_INTELLIGENCE_EVENT_STATUSES)[number]

export const VOICE_MEMORY_DRAFT_STATUSES = ["pending_review", "accepted", "rejected"] as const
export type VoiceMemoryDraftStatus = (typeof VOICE_MEMORY_DRAFT_STATUSES)[number]

export type VoiceIntelligenceEventPublicView = {
  id: string
  eventType: string
  confidenceScore: number
  evidenceText: string
  suggestedOperatorAction: string
  analysisProvider: VoiceIntelligenceAnalysisProvider
  status: VoiceIntelligenceEventStatus
  transcriptSegmentId: string
  sequenceNumber: number | null
  createdAt: string
}

export type VoiceConversationMemoryDraftPublicView = {
  id: string
  draftKind: string
  draftLabel: string
  draftValue: string
  evidenceText: string
  confidenceScore: number
  status: VoiceMemoryDraftStatus
  createdAt: string
}

export type VoiceCallConversationIntelligenceSnapshot = {
  qaMarker: typeof VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER
  voiceCallId: string
  passiveModeEnabled: true
  autonomousActionsDisabled: true
  liveSignals: VoiceIntelligenceEventPublicView[]
  objections: VoiceIntelligenceEventPublicView[]
  buyingSignals: VoiceIntelligenceEventPublicView[]
  riskEvents: VoiceIntelligenceEventPublicView[]
  operatorGuidance: VoiceIntelligenceEventPublicView[]
  suggestedNextBestAction: VoiceIntelligenceEventPublicView | null
  memoryDrafts: VoiceConversationMemoryDraftPublicView[]
  analysisProvider: VoiceIntelligenceAnalysisProvider
  generatedAt: string
}

export type VoiceConversationIntelligenceReadinessSnapshot = {
  qaMarker: typeof VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER
  schemaReady: boolean
  transcriptProviderStatus: string
  analysisProviderStatus: VoiceIntelligenceAnalysisProvider
  passiveModeEnabled: true
  autonomousActionsDisabled: true
  evidenceRequirementEnabled: true
  intelligenceReady: boolean
  message: string
  warnings: string[]
}

export type VoiceIntelligenceSegmentInput = {
  organizationId: string
  voiceCallId: string
  transcriptSessionId: string
  transcriptSegmentId: string
  sequenceNumber: number
  speakerType: string
  transcriptText: string
  confidenceScore: number | null
}

export type VoiceIntelligenceInsightDraft = {
  category: "conversation" | "objection" | "buying_signal" | "risk" | "guidance"
  eventType: string
  confidenceScore: number
  evidenceText: string
  suggestedOperatorAction: string
  memoryDraft?: {
    draftKind: string
    draftLabel: string
    draftValue: string
  } | null
}

export type VoiceIntelligenceAnalysisResult = {
  provider: VoiceIntelligenceAnalysisProvider
  insights: VoiceIntelligenceInsightDraft[]
}
