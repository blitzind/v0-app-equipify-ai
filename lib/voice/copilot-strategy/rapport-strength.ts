/** Rapport strength estimation — Phase 3B. */

import type { VoiceRapportStrengthEstimation } from "@/lib/voice/copilot-strategy/types"

export function estimateRapportStrength(transcriptTexts: string[]): VoiceRapportStrengthEstimation {
  const combined = transcriptTexts.join(" ")
  let score = 50

  if (/\b(thank you|appreciate|great question|good point|that helps)\b/i.test(combined)) score += 20
  if (/\b(sorry|apologize|understand your frustration)\b/i.test(combined)) score += 10
  if (/\b(no|not interested|stop|waste of time|ridiculous)\b/i.test(combined)) score -= 25
  if (/\b(angry|frustrated|annoyed)\b/i.test(combined)) score -= 20
  score = Math.max(0, Math.min(100, score))

  let direction: VoiceRapportStrengthEstimation["direction"] = "stable"
  if (score >= 65) direction = "strengthening"
  else if (score <= 35) direction = "weakening"

  return {
    score,
    direction,
    evidenceText: combined.slice(0, 160) || "Insufficient rapport signals in transcript window.",
    confidenceScore: combined.length >= 30 ? 0.72 : 0.5,
  }
}
