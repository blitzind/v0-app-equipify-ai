/** Client-safe unified operator assist orchestration builder. */

import type { CallWorkspaceCoachingMode } from "@/lib/growth/native-dialer/call-workspace-coaching-types"
import type { GrowthLiveCoachingState, GrowthLiveGuidanceEvent } from "@/lib/growth/live-guidance/live-guidance-types"
import type { GrowthRealtimeLiveSnapshot, GrowthRealtimeTranscriptEvent } from "@/lib/growth/realtime/realtime-call-types"
import type { NativeDialerLeadContext } from "@/lib/growth/native-dialer/native-dialer-types"
import type { VoiceCallConversationIntelligenceSnapshot, VoiceIntelligenceEventPublicView } from "@/lib/voice/intelligence/types"
import type { VoiceCallTranscriptSnapshot } from "@/lib/voice/media-streaming/types"
import type { VoiceConferenceParticipantPublicView } from "@/lib/voice/transfer-control/types"
import {
  buildAssistDedupeKey,
  dedupeUnifiedAssistEvents,
  preferGrowthGuidanceOnConflict,
} from "@/lib/growth/operator-assist/deduplication"
import { detectConversationalInterruptions } from "@/lib/growth/operator-assist/interruption-detection"
import {
  isActiveAssistLifecycle,
  normalizeGrowthGuidanceLifecycle,
  normalizeVoiceIntelligenceLifecycle,
} from "@/lib/growth/operator-assist/lifecycle"
import { resolveUnifiedNextBestAction } from "@/lib/growth/operator-assist/nba-resolver"
import {
  DEFAULT_OPERATOR_ASSIST_PREFERENCES,
  VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER,
  type CanonicalTranscriptSource,
  type OperatorAssistPreferencesPublicView,
  type UnifiedOperatorAssistCategory,
  type UnifiedOperatorAssistEvent,
  type UnifiedOperatorAssistSnapshot,
} from "@/lib/growth/operator-assist/types"
import {
  partitionUnifiedAssistFeed,
  passesMinimumPriorityFilter,
  rankUnifiedAssistEvents,
  scoreUnifiedAssistEvent,
} from "@/lib/growth/operator-assist/unified-priority"

function voiceCategoryFromEvent(event: VoiceIntelligenceEventPublicView): UnifiedOperatorAssistCategory {
  if (event.eventType.includes("objection") || event.eventType.includes("competitor")) return "objection"
  if (event.eventType.includes("book") || event.eventType.includes("signal") || event.eventType.includes("decision")) {
    return "buying_signal"
  }
  if (
    ["angry_caller", "cancellation_risk", "opt_out_intent", "compliance_sensitive_language"].includes(event.eventType)
  ) {
    return "risk"
  }
  if (event.eventType.includes("guidance") || event.eventType.includes("next_best")) return "guidance"
  return "conversation"
}

function voiceSourceKind(event: VoiceIntelligenceEventPublicView): UnifiedOperatorAssistEvent["sourceKind"] {
  const category = voiceCategoryFromEvent(event)
  if (category === "objection") return "voice_objection"
  if (category === "buying_signal") return "voice_buying_signal"
  if (category === "risk") return "voice_risk"
  if (category === "guidance") return "voice_guidance"
  return "voice_conversation"
}

function mapVoiceEvent(event: VoiceIntelligenceEventPublicView, voiceCallId: string): UnifiedOperatorAssistEvent {
  const category = voiceCategoryFromEvent(event)
  const lifecycleStatus = normalizeVoiceIntelligenceLifecycle(event)
  const severity =
    category === "risk" ? "high" : category === "objection" ? "medium" : category === "buying_signal" ? "medium" : "low"
  const base = {
    id: `voice:${event.id}`,
    source: "voice_intelligence" as const,
    sourceKind: voiceSourceKind(event),
    lifecycleStatus,
    category,
    eventType: event.eventType,
    severity,
    title: event.eventType.replace(/_/g, " "),
    operatorPrompt: event.suggestedOperatorAction,
    recommendation: event.suggestedOperatorAction,
    evidenceText: event.evidenceText,
    confidenceScore: event.confidenceScore,
    surfacedAt: event.createdAt,
    expiresAt: null,
    transcriptSegmentId: event.transcriptSegmentId,
    sequenceNumber: event.sequenceNumber,
    voiceCallId,
    growthGuidanceEventId: null,
    coachingLeadId: null,
    realtimeSessionId: null,
    dedupeKey: buildAssistDedupeKey({
      category,
      eventType: event.eventType,
      evidenceText: event.evidenceText,
    }),
  }
  const scored = scoreUnifiedAssistEvent(base)
  return { ...base, ...scored }
}

function mapGrowthGuidanceEvent(event: GrowthLiveGuidanceEvent): UnifiedOperatorAssistEvent {
  const lifecycleStatus = normalizeGrowthGuidanceLifecycle(event)
  const category: UnifiedOperatorAssistCategory =
    event.eventType.includes("objection") || event.eventType === "competitor_response"
      ? "objection"
      : event.eventType.includes("buying") || event.eventType.includes("close") || event.eventType.includes("meeting")
        ? "buying_signal"
        : event.eventType.includes("risk") || event.eventType === "executive_risk"
          ? "risk"
          : "coaching"
  const base = {
    id: `growth:${event.id}`,
    source: "growth_guidance" as const,
    sourceKind: "growth_guidance" as const,
    lifecycleStatus,
    category,
    eventType: event.eventType,
    severity: event.severity,
    title: event.title,
    operatorPrompt: event.operatorPrompt,
    recommendation: event.recommendation,
    evidenceText: event.supportingReason,
    confidenceScore: event.confidenceScore,
    surfacedAt: event.surfacedAt,
    expiresAt: null,
    transcriptSegmentId: null,
    sequenceNumber: null,
    voiceCallId: null,
    growthGuidanceEventId: event.id,
    coachingLeadId: event.leadId,
    realtimeSessionId: event.realtimeCallSessionId,
    dedupeKey: buildAssistDedupeKey({
      category,
      eventType: event.eventType,
      evidenceText: event.supportingReason || event.operatorPrompt,
    }),
  }
  const scored = scoreUnifiedAssistEvent(base)
  return { ...base, ...scored }
}

export function resolveCanonicalTranscriptSource(input: {
  voiceTranscript: VoiceCallTranscriptSnapshot | null
  growthEventCount: number
}): CanonicalTranscriptSource {
  if (input.voiceTranscript?.segments?.length) return "voice_segments"
  if (input.growthEventCount > 0) return "growth_realtime"
  return "none"
}

export function buildUnifiedOperatorAssistSnapshot(input: {
  coachingState: GrowthLiveCoachingState | null
  coachingMode: CallWorkspaceCoachingMode | null
  coachingLeadId: string | null
  realtimeSessionId: string | null
  voiceCallId: string | null
  conversationIntelligence: VoiceCallConversationIntelligenceSnapshot | null
  voiceTranscript: VoiceCallTranscriptSnapshot | null
  growthTranscriptEvents?: GrowthRealtimeTranscriptEvent[]
  liveSnapshot: GrowthRealtimeLiveSnapshot | null
  leadContext: Pick<NativeDialerLeadContext, "recommendedNextAction"> | null
  participants?: VoiceConferenceParticipantPublicView[]
  preferences?: OperatorAssistPreferencesPublicView
  generatedAt?: string
}): UnifiedOperatorAssistSnapshot {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const preferences = input.preferences ?? DEFAULT_OPERATOR_ASSIST_PREFERENCES
  const canonicalTranscriptSource = resolveCanonicalTranscriptSource({
    voiceTranscript: input.voiceTranscript,
    growthEventCount: input.growthTranscriptEvents?.length ?? 0,
  })

  const voiceEvents = input.conversationIntelligence
    ? [
        ...input.conversationIntelligence.objections,
        ...input.conversationIntelligence.buyingSignals,
        ...input.conversationIntelligence.riskEvents,
        ...input.conversationIntelligence.operatorGuidance,
        ...input.conversationIntelligence.liveSignals,
      ].map((event) => mapVoiceEvent(event, input.voiceCallId ?? input.conversationIntelligence!.voiceCallId))
    : []

  const growthEvents = (input.coachingState?.activeGuidance ?? []).map(mapGrowthGuidanceEvent)

  const interruptionSummary = detectConversationalInterruptions({
    voiceTranscript: canonicalTranscriptSource === "voice_segments" ? input.voiceTranscript : null,
    growthEvents:
      canonicalTranscriptSource === "growth_realtime" ? input.growthTranscriptEvents ?? [] : input.growthTranscriptEvents,
  })

  const interruptionAssistEvents: UnifiedOperatorAssistEvent[] = interruptionSummary.recentEvents.map((event) => {
    const base = {
      id: `interruption:${event.id}`,
      source: "interruption" as const,
      sourceKind: "interruption" as const,
      lifecycleStatus: "active" as const,
      category: "interruption" as const,
      eventType: "conversational_interruption",
      severity: "medium" as const,
      title: "Conversational interruption",
      operatorPrompt:
        event.interruptingSpeaker === "operator"
          ? "Pause and let the customer finish their thought."
          : "Acknowledge the interruption and restate your point briefly.",
      recommendation: event.evidenceText,
      evidenceText: event.evidenceText,
      confidenceScore: event.confidenceScore,
      surfacedAt: event.occurredAt,
      expiresAt: null,
      transcriptSegmentId: null,
      sequenceNumber: null,
      voiceCallId: input.voiceCallId,
      growthGuidanceEventId: null,
      coachingLeadId: input.coachingLeadId,
      realtimeSessionId: input.realtimeSessionId,
      dedupeKey: buildAssistDedupeKey({
        category: "interruption",
        eventType: "conversational_interruption",
        evidenceText: event.evidenceText,
      }),
    }
    return { ...base, ...scoreUnifiedAssistEvent(base) }
  })

  const merged = preferGrowthGuidanceOnConflict(
    dedupeUnifiedAssistEvents([...growthEvents, ...voiceEvents, ...interruptionAssistEvents]),
  )

  const activeFeed = merged.filter((event) => {
    if (!isActiveAssistLifecycle(event.lifecycleStatus)) return false
    if (preferences.quietMode && event.priorityLabel === "Low") return false
    if (!preferences.enabledCategories[event.category]) return false
    if (!passesMinimumPriorityFilter(event, preferences.minimumPriorityLabel)) return false
    return true
  })

  const ranked = rankUnifiedAssistEvents(activeFeed)
  const { topPriority, additional } = partitionUnifiedAssistFeed(ranked)

  const supervisorCount =
    input.participants?.filter((participant) => participant.participantRole === "supervisor").length ?? 0

  return {
    qaMarker: VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER,
    generatedAt,
    passiveModeEnabled: true,
    autonomousActionsDisabled: true,
    canonicalTranscriptSource,
    coachingState: input.coachingState,
    liveSnapshot: input.liveSnapshot,
    coachingMode: input.coachingMode,
    coachingLeadId: input.coachingLeadId,
    realtimeSessionId: input.realtimeSessionId,
    voiceCallId: input.voiceCallId,
    conversationIntelligence: input.conversationIntelligence,
    feed: ranked,
    topPriority,
    additional,
    nextBestAction: resolveUnifiedNextBestAction({
      coachingState: input.coachingState,
      liveSnapshot: input.liveSnapshot,
      conversationIntelligence: input.conversationIntelligence,
      leadContext: input.leadContext,
      rankedAssistEvents: ranked,
    }),
    interruptionSummary,
    supervisorVisibility: {
      assistFeedReadOnly: true,
      participantsVisible: Boolean(input.participants?.length),
      activeSupervisorCount: supervisorCount,
      supervisorJoinAvailable: Boolean(input.voiceCallId),
      message:
        supervisorCount > 0
          ? "Supervisor connected — assist feed is read-only for monitoring."
          : "Supervisor monitoring uses read-only visibility. No whisper or barge modes.",
    },
    preferences,
  }
}
