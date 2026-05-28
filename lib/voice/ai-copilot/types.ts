/** Voice AI Copilot — Phase 3A/3B shared types (client-safe). */

import type {
  VoiceCopilotStrategySnapshot,
  VoiceOperatorPerformanceInsightPublicView,
} from "@/lib/voice/copilot-strategy/types"

export const VOICE_AI_COPILOT_QA_MARKER = "voice-ai-copilot-v1" as const
export const VOICE_DEEP_COPILOT_QA_MARKER = "voice-deep-copilot-v1" as const

export const VOICE_AI_COPILOT_PASSIVE_MODE_ENABLED = true as const
export const VOICE_AI_COPILOT_AUTONOMOUS_ACTIONS_DISABLED = true as const
export const VOICE_AI_COPILOT_EVIDENCE_REQUIRED = true as const
export const VOICE_AI_COPILOT_GUARDRAILS_ENABLED = true as const

export const VOICE_AI_COPILOT_SUGGESTION_TYPES = [
  "objection_response",
  "next_best_response",
  "discovery_question",
  "booking_prompt",
  "escalation_recommendation",
  "compliance_reminder",
  "call_note_draft",
  "live_summary_draft",
  "follow_up_draft",
  "retention_response",
  "expansion_response",
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

export type VoiceAiCopilotSuggestionType = (typeof VOICE_AI_COPILOT_SUGGESTION_TYPES)[number]

export const VOICE_AI_COPILOT_SUGGESTION_STATUSES = [
  "active",
  "acknowledged",
  "dismissed",
  "copied",
  "expired",
] as const

export type VoiceAiCopilotSuggestionStatus = (typeof VOICE_AI_COPILOT_SUGGESTION_STATUSES)[number]

export const VOICE_AI_COPILOT_PROVIDERS = ["deterministic_template", "openai", "stub"] as const
export type VoiceAiCopilotProviderId = (typeof VOICE_AI_COPILOT_PROVIDERS)[number]

export const VOICE_AI_COPILOT_LIFECYCLE_ACTIONS = [
  "acknowledge",
  "dismiss",
  "copied",
  "expire",
] as const

export type VoiceAiCopilotLifecycleAction = (typeof VOICE_AI_COPILOT_LIFECYCLE_ACTIONS)[number]

export const VOICE_AI_COPILOT_MAX_SUGGESTIONS_PER_CALL = 8 as const
export const VOICE_AI_COPILOT_MAX_SOURCE_EVENTS = 12 as const
export const VOICE_AI_COPILOT_TRANSCRIPT_WINDOW_SEGMENTS = 8 as const
export const VOICE_AI_COPILOT_GENERATION_COOLDOWN_MS = 15_000 as const
export const VOICE_AI_COPILOT_PROVIDER_TIMEOUT_MS = 8_000 as const
export const VOICE_AI_COPILOT_STALE_MINUTES = 10 as const
export const VOICE_AI_COPILOT_EVIDENCE_DEDUPE_CHARS = 160 as const

export type VoiceAiCopilotSuggestionPublicView = {
  id: string
  organizationId: string
  voiceCallId: string
  relationshipMemoryProfileId: string | null
  relatedCustomerId: string | null
  relatedProspectId: string | null
  relatedOpportunityId: string | null
  suggestionType: VoiceAiCopilotSuggestionType
  priority: number
  title: string
  body: string
  evidenceText: string
  sourceEventIds: string[]
  status: VoiceAiCopilotSuggestionStatus
  generatedByProvider: VoiceAiCopilotProviderId
  createdAt: string
  acknowledgedAt: string | null
  dismissedAt: string | null
  copiedAt: string | null
}

export type VoiceAiCopilotWorkspaceSnapshot = {
  qaMarker: typeof VOICE_AI_COPILOT_QA_MARKER
  deepCopilotQaMarker: typeof VOICE_DEEP_COPILOT_QA_MARKER
  voiceCallId: string
  generatedAt: string
  providerMode: VoiceAiCopilotProviderId
  passiveModeEnabled: true
  autonomousActionsDisabled: true
  evidenceRequirementEnabled: true
  guardrailsEnabled: true
  maxSuggestionsPerCall: number
  activeSuggestions: VoiceAiCopilotSuggestionPublicView[]
  topSuggestions: VoiceAiCopilotSuggestionPublicView[]
  draftSuggestions: VoiceAiCopilotSuggestionPublicView[]
  strategy: VoiceCopilotStrategySnapshot | null
  performanceInsights: VoiceOperatorPerformanceInsightPublicView[]
  generationCooldownRemainingMs: number
  canGenerate: boolean
  message: string
}

export type VoiceAiCopilotReadinessSnapshot = {
  qaMarker: typeof VOICE_AI_COPILOT_QA_MARKER
  schemaReady: boolean
  providerMode: VoiceAiCopilotProviderId
  openAiEnabled: boolean
  deterministicFallbackReady: boolean
  deterministicModeActive: boolean
  openAiAugmentationEnabled: boolean
  structuredOutputEnforced: true
  evidenceValidationEnabled: true
  evidenceRequirementEnabled: true
  overloadPreventionEnabled: true
  autonomousActionsDisabled: true
  guardrailsEnabled: true
  maxSuggestionsPerCall: number
  maxActiveSuggestions: number
  escalationSafeModeEnabled: true
  performanceInsightsReady: boolean
  activeSuggestionCount: number
  message: string
}

export type VoiceAiCopilotGenerationDraft = {
  suggestionType: VoiceAiCopilotSuggestionType
  priority: number
  title: string
  body: string
  evidenceText: string
  sourceEventIds: string[]
}
