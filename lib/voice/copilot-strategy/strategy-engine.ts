/** Copilot strategy engine — Phase 3B orchestration. */

import type { UnifiedOperatorAssistSnapshot } from "@/lib/growth/operator-assist/types"
import type { VoiceCallTranscriptSnapshot } from "@/lib/voice/media-streaming/types"
import type { VoiceRetentionIntelligenceWorkspaceSnapshot } from "@/lib/voice/retention-intelligence/types"
import { analyzeConversationPacing } from "@/lib/voice/copilot-strategy/pacing-analysis"
import { detectCallQualityInsights } from "@/lib/voice/copilot-strategy/call-quality"
import { detectCloseReadiness } from "@/lib/voice/copilot-strategy/close-readiness"
import { analyzeDiscoveryCompleteness } from "@/lib/voice/copilot-strategy/discovery-completeness"
import { analyzeEscalationLikelihood } from "@/lib/voice/copilot-strategy/escalation-likelihood"
import { mapObjectionStage } from "@/lib/voice/copilot-strategy/objection-stage"
import { detectConversationPhase } from "@/lib/voice/copilot-strategy/phase-detection"
import { isOperatorOverloadActive } from "@/lib/voice/copilot-strategy/prioritization"
import { estimateRapportStrength } from "@/lib/voice/copilot-strategy/rapport-strength"
import { buildStructuredCallNotes, buildStructuredFollowUpOutline } from "@/lib/voice/copilot-strategy/structured-notes"
import type { VoiceCopilotStrategySnapshot } from "@/lib/voice/copilot-strategy/types"
import { VOICE_DEEP_COPILOT_QA_MARKER } from "@/lib/voice/copilot-strategy/types"
import { VOICE_AI_COPILOT_TRANSCRIPT_WINDOW_SEGMENTS } from "@/lib/voice/ai-copilot/types"

export type BuildStrategyInput = {
  operatorAssist: UnifiedOperatorAssistSnapshot | null
  liveTranscript: VoiceCallTranscriptSnapshot | null
  retentionIntelligence: VoiceRetentionIntelligenceWorkspaceSnapshot | null
}

export function buildCopilotStrategySnapshot(input: BuildStrategyInput): VoiceCopilotStrategySnapshot {
  const segments =
    input.liveTranscript?.segments.slice(-VOICE_AI_COPILOT_TRANSCRIPT_WINDOW_SEGMENTS).map((s) => ({
      speakerType: s.speakerType,
      text: s.transcriptText,
    })) ?? []
  const transcriptTexts = segments.map((s) => s.text)

  const feed = input.operatorAssist?.feed ?? []
  const objectionEvents = feed.filter((e) => e.category === "objection")
  const buyingSignalEvents = feed.filter((e) => e.category === "buying_signal")
  const riskEvents = feed.filter((e) => e.category === "risk")
  const interruptionCount = feed.filter((e) => e.category === "interruption").length

  const categoryCounts: Record<string, number> = {}
  for (const event of feed) {
    categoryCounts[event.category] = (categoryCounts[event.category] ?? 0) + 1
  }

  const retentionRiskActive =
    input.retentionIntelligence?.retentionRiskLevel === "elevated" ||
    input.retentionIntelligence?.retentionRiskLevel === "critical"

  const conversationPhase = detectConversationPhase({
    transcriptTexts,
    objectionCount: objectionEvents.length,
    buyingSignalCount: buyingSignalEvents.length,
    riskCount: riskEvents.length,
    retentionRiskActive,
    operatorAssistCategoryCounts: categoryCounts,
  })

  const objectionStage = mapObjectionStage({
    objectionEvents: objectionEvents.map((e) => ({ title: e.title, evidenceText: e.evidenceText })),
    transcriptTexts,
  })

  const discoveryCompleteness = analyzeDiscoveryCompleteness(transcriptTexts)
  const pacing = analyzeConversationPacing(segments)
  const escalationLikelihood = analyzeEscalationLikelihood({
    riskEventCount: riskEvents.length,
    objectionCount: objectionEvents.length,
    interruptionCount,
    transcriptTexts,
    retentionRiskActive,
  })
  const closeReadiness = detectCloseReadiness({
    buyingSignalCount: buyingSignalEvents.length,
    discoveryScore: discoveryCompleteness.score,
    objectionStage: objectionStage.stage,
    transcriptTexts,
  })
  const rapportStrength = estimateRapportStrength(transcriptTexts)

  const closeAttemptDetected = /\b(move forward|ready to|sign up|next step)\b/i.test(transcriptTexts.join(" "))

  const callQualityInsights = detectCallQualityInsights({
    pacing,
    discovery: discoveryCompleteness,
    objectionStage,
    escalation: escalationLikelihood,
    buyingSignalCount: buyingSignalEvents.length,
    closeAttemptDetected,
    interruptionCount,
    segmentCount: segments.length,
  })

  const structuredNotes = buildStructuredCallNotes({
    transcriptTexts,
    objectionEvents: objectionEvents.map((e) => ({ title: e.title, evidenceText: e.evidenceText })),
    buyingSignalEvents: buyingSignalEvents.map((e) => ({ title: e.title, evidenceText: e.evidenceText })),
    riskEvents: riskEvents.map((e) => ({ title: e.title, evidenceText: e.evidenceText })),
    phase: conversationPhase.phase,
  })

  const structuredFollowUp = buildStructuredFollowUpOutline({
    notes: structuredNotes,
    phase: conversationPhase.phase,
    retentionRecovery: conversationPhase.phase === "retention_recovery" || retentionRiskActive,
    expansionSignal: (input.retentionIntelligence?.topExpansionSignals.length ?? 0) > 0,
  })

  const overloadPreventionActive = isOperatorOverloadActive(feed.length)
  const escalationSafeModeEnabled =
    escalationLikelihood.level === "elevated" || escalationLikelihood.level === "critical"

  return {
    qaMarker: VOICE_DEEP_COPILOT_QA_MARKER,
    conversationPhase,
    objectionStage,
    discoveryCompleteness,
    escalationLikelihood,
    closeReadiness,
    rapportStrength,
    pacing,
    callQualityInsights,
    structuredNotes,
    structuredFollowUp,
    overloadPreventionActive,
    escalationSafeModeEnabled,
  }
}
