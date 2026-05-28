/** Passive call-quality insights — Phase 3B (coaching only, non-punitive). */

import type { VoiceCallQualityInsight } from "@/lib/voice/copilot-strategy/types"
import type { VoiceConversationPacingAnalysis } from "@/lib/voice/copilot-strategy/types"
import type { VoiceDiscoveryCompletenessAnalysis } from "@/lib/voice/copilot-strategy/types"
import type { VoiceEscalationLikelihoodAnalysis } from "@/lib/voice/copilot-strategy/types"
import type { VoiceObjectionStageMapping } from "@/lib/voice/copilot-strategy/types"

export function detectCallQualityInsights(input: {
  pacing: VoiceConversationPacingAnalysis
  discovery: VoiceDiscoveryCompletenessAnalysis
  objectionStage: VoiceObjectionStageMapping
  escalation: VoiceEscalationLikelihoodAnalysis
  buyingSignalCount: number
  closeAttemptDetected: boolean
  interruptionCount: number
  segmentCount: number
}): VoiceCallQualityInsight[] {
  const insights: VoiceCallQualityInsight[] = []

  if (input.segmentCount >= 4 && input.pacing.operatorTalkPercent >= 72) {
    insights.push({
      id: "cq:pacing:operator_heavy",
      kind: "excessive_interruption",
      title: "Operator talk ratio high",
      coachingPrompt: "Pause and ask an open question — let the customer share more before continuing.",
      evidenceText: input.pacing.evidenceText,
      confidenceScore: 0.76,
    })
  }

  if (input.interruptionCount >= 3) {
    insights.push({
      id: "cq:interrupt:high",
      kind: "excessive_interruption",
      title: "Frequent interruptions detected",
      coachingPrompt: "Allow the customer to finish thoughts before responding — assistive coaching only.",
      evidenceText: `${input.interruptionCount} interruption signals in assist feed.`,
      confidenceScore: 0.74,
    })
  }

  if (input.discovery.score < 45 && input.segmentCount >= 5) {
    insights.push({
      id: "cq:discovery:weak",
      kind: "weak_discovery",
      title: "Discovery coverage gap",
      coachingPrompt: `Explore uncovered areas: ${input.discovery.gaps.slice(0, 2).join(", ")}.`,
      evidenceText: input.discovery.evidenceText,
      confidenceScore: input.discovery.confidenceScore,
    })
  }

  if (input.objectionStage.stage === "unresolved" || input.objectionStage.activeObjectionCount >= 2) {
    insights.push({
      id: "cq:objection:unresolved",
      kind: "unresolved_objection",
      title: "Unresolved objection active",
      coachingPrompt: "Acknowledge the objection explicitly before moving to close or pricing.",
      evidenceText: input.objectionStage.evidenceText,
      confidenceScore: input.objectionStage.confidenceScore,
    })
  }

  if (input.closeAttemptDetected && input.discovery.score < 50) {
    insights.push({
      id: "cq:close:rushed",
      kind: "rushed_close",
      title: "Close attempt with thin discovery",
      coachingPrompt: "Slow down — confirm pain and timeline before asking for commitment.",
      evidenceText: input.discovery.evidenceText,
      confidenceScore: 0.7,
    })
  }

  if (input.buyingSignalCount >= 2 && !input.closeAttemptDetected) {
    insights.push({
      id: "cq:booking:missed",
      kind: "missed_booking",
      title: "Booking opportunity signal",
      coachingPrompt: "Customer showed interest — consider offering specific times (operator books manually).",
      evidenceText: `${input.buyingSignalCount} buying signals without close attempt in window.`,
      confidenceScore: 0.72,
    })
  }

  if (input.escalation.level === "elevated" || input.escalation.level === "critical") {
    insights.push({
      id: "cq:escalation:unresolved",
      kind: "unresolved_escalation",
      title: "Escalation risk elevated",
      coachingPrompt: "De-escalate and confirm understanding — operator decides escalation path.",
      evidenceText: input.escalation.evidenceText,
      confidenceScore: input.escalation.confidenceScore,
    })
  }

  return insights.slice(0, 5)
}
