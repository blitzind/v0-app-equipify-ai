/** Multichannel intelligence snapshot builders — Phase 6A. */

import type {
  VoiceMultichannelIntelligenceCommandSummary,
  VoiceMultichannelIntelligenceWorkspaceSnapshot,
  VoiceCommunicationHealthSummary,
  VoiceMultichannelRecommendation,
  VoicePreferredChannelInsight,
  VoiceUnifiedCommunicationEventPublicView,
  VoiceUnifiedCommunicationThreadPublicView,
} from "@/lib/voice/multi-channel-intelligence/types"
import { VOICE_MULTICHANNEL_INTELLIGENCE_QA_MARKER } from "@/lib/voice/multi-channel-intelligence/types"

export function buildMultichannelWorkspaceSnapshot(input: {
  activeThreads: VoiceUnifiedCommunicationThreadPublicView[]
  recentEvents: VoiceUnifiedCommunicationEventPublicView[]
  preferredChannelInsights: VoicePreferredChannelInsight[]
  health: VoiceCommunicationHealthSummary
  recommendations: VoiceMultichannelRecommendation[]
}): VoiceMultichannelIntelligenceWorkspaceSnapshot {
  return {
    qaMarker: VOICE_MULTICHANNEL_INTELLIGENCE_QA_MARKER,
    generatedAt: new Date().toISOString(),
    activeThreads: input.activeThreads,
    recentEvents: input.recentEvents,
    preferredChannelInsights: input.preferredChannelInsights,
    health: input.health,
    recommendations: input.recommendations,
    autonomousOmnichannelDisabled: true,
    message: "Unified multi-channel communications intelligence — operator-controlled, no autonomous engagement.",
  }
}

export function buildMultichannelCommandSummary(input: {
  activeThreads: VoiceUnifiedCommunicationThreadPublicView[]
  health: VoiceCommunicationHealthSummary
}): VoiceMultichannelIntelligenceCommandSummary {
  const active = input.activeThreads

  return {
    qaMarker: VOICE_MULTICHANNEL_INTELLIGENCE_QA_MARKER,
    activeThreadCount: active.length,
    escalatedCount: active.filter((t) => t.currentState === "escalated").length,
    stalledCount: active.filter((t) => t.currentState === "stalled").length,
    unresolvedIssueCount: active.reduce((sum, t) => sum + t.unresolvedIssueCount, 0),
    fatigueWarningCount: input.health.fatigueCount,
    message: "Multi-channel communication metrics — visibility only, no autonomous campaigns.",
  }
}
