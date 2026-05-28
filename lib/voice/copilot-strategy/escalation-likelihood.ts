/** Escalation likelihood analysis — Phase 3B. */

import type { VoiceEscalationLikelihoodAnalysis, VoiceEscalationRiskLevel } from "@/lib/voice/copilot-strategy/types"

export function analyzeEscalationLikelihood(input: {
  riskEventCount: number
  objectionCount: number
  interruptionCount: number
  transcriptTexts: string[]
  retentionRiskActive: boolean
}): VoiceEscalationLikelihoodAnalysis {
  const combined = input.transcriptTexts.join(" ")
  let score = 0

  if (/\b(angry|furious|unacceptable|ridiculous|lawyer|sue|report you)\b/i.test(combined)) score += 35
  if (/\b(manager|supervisor|escalate|speak to someone else)\b/i.test(combined)) score += 25
  if (input.riskEventCount >= 2) score += 20
  if (input.objectionCount >= 3) score += 15
  if (input.interruptionCount >= 4) score += 10
  if (input.retentionRiskActive) score += 20
  score = Math.min(100, score)

  let level: VoiceEscalationRiskLevel = "low"
  if (score >= 70) level = "critical"
  else if (score >= 50) level = "elevated"
  else if (score >= 30) level = "moderate"

  const evidenceText =
    score >= 30
      ? combined.slice(0, 160) || `${input.riskEventCount} risk events, ${input.objectionCount} objections.`
      : "No strong escalation signals in current window."

  return {
    level,
    score,
    evidenceText,
    confidenceScore: combined.length >= 30 ? 0.8 : 0.55,
  }
}
