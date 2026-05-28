/** Conversation phase detection — Phase 3B (deterministic-first). */

import type {
  VoiceConversationPhase,
  VoiceConversationPhaseDetection,
} from "@/lib/voice/copilot-strategy/types"

export type PhaseDetectionInput = {
  transcriptTexts: string[]
  objectionCount: number
  buyingSignalCount: number
  riskCount: number
  retentionRiskActive: boolean
  operatorAssistCategoryCounts: Record<string, number>
}

const PHASE_PATTERNS: Array<{ phase: VoiceConversationPhase; pattern: RegExp; weight: number }> = [
  { phase: "introduction", pattern: /\b(hi|hello|thanks for calling|my name is|who am i speaking with)\b/i, weight: 0.7 },
  { phase: "discovery", pattern: /\b(tell me about|what are you|how do you currently|walk me through|help me understand)\b/i, weight: 0.85 },
  { phase: "qualification", pattern: /\b(budget|timeline|decision maker|who else|authority|approval process)\b/i, weight: 0.88 },
  { phase: "objection_handling", pattern: /\b(too expensive|not ready|already use|competitor|concern|worried about)\b/i, weight: 0.9 },
  { phase: "pricing_discussion", pattern: /\b(price|pricing|cost|quote|rate|discount|fee)\b/i, weight: 0.87 },
  { phase: "booking_attempt", pattern: /\b(schedule|book|calendar|meeting|demo|set up a time)\b/i, weight: 0.86 },
  { phase: "escalation_risk", pattern: /\b(angry|unacceptable|manager|supervisor|lawyer|cancel|stop calling)\b/i, weight: 0.92 },
  { phase: "close_attempt", pattern: /\b(move forward|sign up|get started|next step|ready to proceed)\b/i, weight: 0.84 },
  { phase: "follow_up_scheduling", pattern: /\b(follow up|call back|send me|email me|circle back)\b/i, weight: 0.8 },
  { phase: "retention_recovery", pattern: /\b(renew|renewal|churn|cancel subscription|not renewing|stay with)\b/i, weight: 0.89 },
]

export function detectConversationPhase(input: PhaseDetectionInput): VoiceConversationPhaseDetection {
  const combined = input.transcriptTexts.join(" ").trim()
  let bestPhase: VoiceConversationPhase = "introduction"
  let bestScore = 0.5
  let bestEvidence = combined.slice(0, 120) || "Call opening — limited transcript evidence."

  if (input.retentionRiskActive || input.operatorAssistCategoryCounts.risk >= 2) {
    return {
      phase: "escalation_risk",
      confidenceScore: 0.82,
      evidenceText: combined.slice(0, 160) || "Multiple risk signals in operator assist feed.",
      previousPhase: null,
    }
  }

  for (const { phase, pattern, weight } of PHASE_PATTERNS) {
    if (pattern.test(combined)) {
      const score = weight
      if (score > bestScore) {
        bestScore = score
        bestPhase = phase
        const match = combined.match(pattern)
        bestEvidence = match ? match[0] : combined.slice(0, 120)
      }
    }
  }

  if (input.objectionCount >= 2 && bestScore < 0.88) {
    bestPhase = "objection_handling"
    bestScore = Math.max(bestScore, 0.78)
    bestEvidence = `${input.objectionCount} objection signals detected in assist feed.`
  } else if (input.buyingSignalCount >= 2 && bestPhase !== "escalation_risk") {
    bestPhase = "booking_attempt"
    bestScore = Math.max(bestScore, 0.76)
    bestEvidence = `${input.buyingSignalCount} buying signals in assist feed.`
  } else if (combined.length < 40 && input.transcriptTexts.length <= 2) {
    bestPhase = "introduction"
    bestScore = 0.65
    bestEvidence = "Early call — limited transcript window."
  }

  return {
    phase: bestPhase,
    confidenceScore: Math.min(1, bestScore),
    evidenceText: bestEvidence,
    previousPhase: null,
  }
}
