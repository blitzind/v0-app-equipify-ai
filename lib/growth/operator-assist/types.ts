/** Unified operator assist orchestration — Phase 2B (client-safe). */

import type { CallWorkspaceCoachingMode } from "@/lib/growth/native-dialer/call-workspace-coaching-types"
import type {
  GrowthLiveCoachingState,
  GrowthLiveGuidanceSeverity,
} from "@/lib/growth/live-guidance/live-guidance-types"
import type { GrowthLiveGuidancePriorityLabel } from "@/lib/growth/live-guidance/live-guidance-priority"
import type { GrowthRealtimeLiveSnapshot } from "@/lib/growth/realtime/realtime-call-types"
import type { VoiceCallConversationIntelligenceSnapshot } from "@/lib/voice/intelligence/types"
import type { CallWorkspaceAiosLiveReasoningSnapshot } from "@/lib/growth/operator-assist/call-workspace-aios-live-reasoning-types"

export const VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER = "voice-unified-operator-assist-v1" as const

export const UNIFIED_OPERATOR_ASSIST_LIFECYCLE_STATUSES = [
  "active",
  "acknowledged",
  "dismissed",
  "resolved",
  "expired",
  "escalated",
] as const

export type UnifiedOperatorAssistLifecycleStatus = (typeof UNIFIED_OPERATOR_ASSIST_LIFECYCLE_STATUSES)[number]

export const UNIFIED_OPERATOR_ASSIST_EVENT_SOURCES = [
  "growth_guidance",
  "voice_intelligence",
  "interruption",
  "aios_reasoning",
] as const

export type UnifiedOperatorAssistEventSource = (typeof UNIFIED_OPERATOR_ASSIST_EVENT_SOURCES)[number]

export const UNIFIED_OPERATOR_ASSIST_CATEGORIES = [
  "objection",
  "buying_signal",
  "risk",
  "guidance",
  "coaching",
  "interruption",
  "conversation",
] as const

export type UnifiedOperatorAssistCategory = (typeof UNIFIED_OPERATOR_ASSIST_CATEGORIES)[number]

export type UnifiedOperatorAssistEvent = {
  id: string
  source: UnifiedOperatorAssistEventSource
  sourceKind: "growth_guidance" | "voice_objection" | "voice_buying_signal" | "voice_risk" | "voice_guidance" | "voice_conversation" | "interruption" | "aios_reasoning"
  lifecycleStatus: UnifiedOperatorAssistLifecycleStatus
  category: UnifiedOperatorAssistCategory
  eventType: string
  severity: GrowthLiveGuidanceSeverity
  title: string
  operatorPrompt: string
  recommendation: string
  evidenceText: string
  confidenceScore: number
  priorityLabel: GrowthLiveGuidancePriorityLabel
  priorityScore: number
  surfacedAt: string
  expiresAt: string | null
  dedupeKey: string
  transcriptSegmentId: string | null
  sequenceNumber: number | null
  voiceCallId: string | null
  growthGuidanceEventId: string | null
  coachingLeadId: string | null
  realtimeSessionId: string | null
}

export type UnifiedNextBestActionItem = {
  title: string
  prompt: string
  evidenceText: string
  confidenceScore: number
  source: string
  dedupeKey: string
}

export type UnifiedNextBestActionSnapshot = {
  primary: UnifiedNextBestActionItem | null
  supporting: UnifiedNextBestActionItem[]
}

export type ConversationalInterruptionSummary = {
  operatorInterruptions: number
  customerInterruptions: number
  totalInterruptions: number
  recentEvents: Array<{
    id: string
    interruptedSpeaker: "operator" | "customer"
    interruptingSpeaker: "operator" | "customer"
    evidenceText: string
    occurredAt: string
    confidenceScore: number
  }>
}

export type OperatorAssistPreferencesPublicView = {
  quietMode: boolean
  minimumPriorityLabel: GrowthLiveGuidancePriorityLabel
  enabledCategories: Record<UnifiedOperatorAssistCategory, boolean>
}

export const DEFAULT_OPERATOR_ASSIST_PREFERENCES: OperatorAssistPreferencesPublicView = {
  quietMode: false,
  minimumPriorityLabel: "Low",
  enabledCategories: {
    objection: true,
    buying_signal: true,
    risk: true,
    guidance: true,
    coaching: true,
    interruption: true,
    conversation: true,
  },
}

export type SupervisorVisibilitySnapshot = {
  assistFeedReadOnly: true
  participantsVisible: boolean
  activeSupervisorCount: number
  supervisorJoinAvailable: boolean
  message: string
}

export type CanonicalTranscriptSource = "voice_segments" | "growth_realtime" | "none"

export type UnifiedOperatorAssistSnapshot = {
  qaMarker: typeof VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER
  generatedAt: string
  passiveModeEnabled: true
  autonomousActionsDisabled: true
  canonicalTranscriptSource: CanonicalTranscriptSource
  coachingState: GrowthLiveCoachingState | null
  liveSnapshot: GrowthRealtimeLiveSnapshot | null
  coachingMode: CallWorkspaceCoachingMode | null
  coachingLeadId: string | null
  realtimeSessionId: string | null
  voiceCallId: string | null
  conversationIntelligence: VoiceCallConversationIntelligenceSnapshot | null
  aiosLiveReasoning: CallWorkspaceAiosLiveReasoningSnapshot | null
  feed: UnifiedOperatorAssistEvent[]
  topPriority: UnifiedOperatorAssistEvent[]
  additional: UnifiedOperatorAssistEvent[]
  nextBestAction: UnifiedNextBestActionSnapshot
  interruptionSummary: ConversationalInterruptionSummary
  supervisorVisibility: SupervisorVisibilitySnapshot
  preferences: OperatorAssistPreferencesPublicView
}
