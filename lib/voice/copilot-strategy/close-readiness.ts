/** Close readiness detection — Phase 3B. */

import type { VoiceCloseReadinessDetection } from "@/lib/voice/copilot-strategy/types"

export function detectCloseReadiness(input: {
  buyingSignalCount: number
  discoveryScore: number
  objectionStage: string
  transcriptTexts: string[]
}): VoiceCloseReadinessDetection {
  const combined = input.transcriptTexts.join(" ")
  let score = 0

  if (input.buyingSignalCount >= 2) score += 30
  if (input.discoveryScore >= 60) score += 25
  if (input.objectionStage === "resolved") score += 20
  if (/\b(ready|move forward|next step|sounds good|let's do it)\b/i.test(combined)) score += 25
  if (input.objectionStage === "unresolved") score -= 20
  score = Math.max(0, Math.min(100, score))

  return {
    ready: score >= 65,
    score,
    evidenceText:
      score >= 50
        ? combined.slice(0, 160) || `${input.buyingSignalCount} buying signals, discovery ${input.discoveryScore}%.`
        : "Close timing not yet supported by evidence.",
    confidenceScore: combined.length >= 40 ? 0.76 : 0.52,
  }
}
