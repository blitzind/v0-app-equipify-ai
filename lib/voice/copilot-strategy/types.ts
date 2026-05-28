/** Voice copilot strategy — Phase 3B shared types (client-safe). */

export const VOICE_DEEP_COPILOT_QA_MARKER = "voice-deep-copilot-v1" as const

export const VOICE_CONVERSATION_PHASES = [
  "introduction",
  "discovery",
  "qualification",
  "objection_handling",
  "pricing_discussion",
  "booking_attempt",
  "escalation_risk",
  "close_attempt",
  "follow_up_scheduling",
  "retention_recovery",
] as const

export type VoiceConversationPhase = (typeof VOICE_CONVERSATION_PHASES)[number]

export const VOICE_ESCALATION_RISK_LEVELS = ["low", "moderate", "elevated", "critical"] as const
export type VoiceEscalationRiskLevel = (typeof VOICE_ESCALATION_RISK_LEVELS)[number]

export const VOICE_OPERATOR_PERFORMANCE_INSIGHT_TYPES = [
  "talk_ratio_trend",
  "interruption_trend",
  "objection_recovery",
  "escalation_avoidance",
  "booking_assistance",
  "follow_up_adherence",
  "sentiment_recovery",
  "pacing_consistency",
] as const

export type VoiceOperatorPerformanceInsightType = (typeof VOICE_OPERATOR_PERFORMANCE_INSIGHT_TYPES)[number]

export type VoiceConversationPhaseDetection = {
  phase: VoiceConversationPhase
  confidenceScore: number
  evidenceText: string
  previousPhase: VoiceConversationPhase | null
}

export type VoiceObjectionStageMapping = {
  stage: "surfaced" | "exploring" | "addressing" | "resolved" | "unresolved"
  confidenceScore: number
  evidenceText: string
  activeObjectionCount: number
}

export type VoiceDiscoveryCompletenessAnalysis = {
  score: number
  gaps: string[]
  evidenceText: string
  confidenceScore: number
}

export type VoiceEscalationLikelihoodAnalysis = {
  level: VoiceEscalationRiskLevel
  score: number
  evidenceText: string
  confidenceScore: number
}

export type VoiceCloseReadinessDetection = {
  ready: boolean
  score: number
  evidenceText: string
  confidenceScore: number
}

export type VoiceRapportStrengthEstimation = {
  score: number
  direction: "strengthening" | "stable" | "weakening"
  evidenceText: string
  confidenceScore: number
}

export type VoiceConversationPacingAnalysis = {
  operatorTalkPercent: number
  customerTalkPercent: number
  pacingLabel: "balanced" | "operator_heavy" | "customer_heavy" | "rushed" | "slow"
  evidenceText: string
  confidenceScore: number
}

export type VoiceCallQualityInsight = {
  id: string
  kind:
    | "excessive_silence"
    | "excessive_interruption"
    | "weak_discovery"
    | "unresolved_objection"
    | "rushed_close"
    | "missed_booking"
    | "unresolved_escalation"
  title: string
  coachingPrompt: string
  evidenceText: string
  confidenceScore: number
}

export type VoiceStructuredCallNotes = {
  keyObjections: string[]
  buyingSignals: string[]
  decisionMakers: string[]
  budgetConcerns: string[]
  timelineReferences: string[]
  commitmentsMade: string[]
  unresolvedConcerns: string[]
  followUpPromises: string[]
  escalationMoments: string[]
  evidenceText: string
}

export type VoiceStructuredFollowUpOutline = {
  callbackOutline: string
  followUpAgenda: string
  relationshipRecoveryOutline: string | null
  renewalDiscussionOutline: string | null
  expansionOpportunityOutline: string | null
  evidenceText: string
}

export type VoiceCopilotStrategySnapshot = {
  qaMarker: typeof VOICE_DEEP_COPILOT_QA_MARKER
  conversationPhase: VoiceConversationPhaseDetection
  objectionStage: VoiceObjectionStageMapping
  discoveryCompleteness: VoiceDiscoveryCompletenessAnalysis
  escalationLikelihood: VoiceEscalationLikelihoodAnalysis
  closeReadiness: VoiceCloseReadinessDetection
  rapportStrength: VoiceRapportStrengthEstimation
  pacing: VoiceConversationPacingAnalysis
  callQualityInsights: VoiceCallQualityInsight[]
  structuredNotes: VoiceStructuredCallNotes
  structuredFollowUp: VoiceStructuredFollowUpOutline
  overloadPreventionActive: boolean
  escalationSafeModeEnabled: boolean
}

export type VoiceOperatorPerformanceInsightPublicView = {
  id: string
  insightType: VoiceOperatorPerformanceInsightType
  metricValue: number | null
  evidenceText: string
  confidenceScore: number
  coachingPrompt: string | null
  createdAt: string
}

export type VoiceDeepCopilotReadinessSnapshot = {
  qaMarker: typeof VOICE_DEEP_COPILOT_QA_MARKER
  schemaReady: boolean
  deterministicModeActive: boolean
  openAiAugmentationEnabled: boolean
  structuredOutputEnforced: true
  evidenceValidationEnabled: true
  overloadPreventionEnabled: true
  autonomousActionsDisabled: true
  maxActiveSuggestions: number
  escalationSafeModeEnabled: true
  performanceInsightsReady: boolean
  message: string
}

export const VOICE_DEEP_COPILOT_MAX_ACTIVE_SUGGESTIONS = 6 as const
export const VOICE_DEEP_COPILOT_OVERLOAD_ASSIST_THRESHOLD = 5 as const
export const VOICE_DEEP_COPILOT_LOW_PRIORITY_SUPPRESSION_SCORE = 45 as const
export const VOICE_DEEP_COPILOT_STRUCTURED_OUTPUT_MAX_DRAFTS = 10 as const

export const VOICE_DEEP_COPILOT_SUGGESTION_TYPES = [
  "objection_strategy",
  "rapport_repair",
  "de_escalation_prompt",
  "pricing_positioning",
  "qualification_gap",
  "close_timing_suggestion",
  "retention_recovery_prompt",
  "expansion_conversation_prompt",
  "operator_pacing_alert",
  "operator_interrupt_alert",
  "compliance_recovery_prompt",
] as const

export type VoiceDeepCopilotSuggestionType = (typeof VOICE_DEEP_COPILOT_SUGGESTION_TYPES)[number]
