/** Discovery completeness analysis — Phase 3B. */

import type { VoiceDiscoveryCompletenessAnalysis } from "@/lib/voice/copilot-strategy/types"

const DISCOVERY_TOPICS = [
  { key: "current situation", pattern: /\b(currently|today|right now|existing|currently use)\b/i },
  { key: "pain points", pattern: /\b(problem|challenge|pain|struggle|frustrat|issue)\b/i },
  { key: "goals", pattern: /\b(goal|success|outcome|want to achieve|looking for)\b/i },
  { key: "timeline", pattern: /\b(when|timeline|quarter|deadline|by when|timeframe)\b/i },
  { key: "budget", pattern: /\b(budget|spend|cost|afford|investment)\b/i },
  { key: "decision process", pattern: /\b(decision|approve|stakeholder|committee|sign off)\b/i },
]

export function analyzeDiscoveryCompleteness(transcriptTexts: string[]): VoiceDiscoveryCompletenessAnalysis {
  const combined = transcriptTexts.join(" ")
  const covered: string[] = []
  const gaps: string[] = []

  for (const topic of DISCOVERY_TOPICS) {
    if (topic.pattern.test(combined)) covered.push(topic.key)
    else gaps.push(topic.key)
  }

  const score = Math.round((covered.length / DISCOVERY_TOPICS.length) * 100)
  const evidenceText =
    covered.length > 0
      ? `Covered: ${covered.join(", ")}. Gaps: ${gaps.slice(0, 3).join(", ")}.`
      : "Limited discovery evidence in transcript window."

  return {
    score,
    gaps: gaps.slice(0, 4),
    evidenceText,
    confidenceScore: combined.length >= 40 ? 0.78 : 0.55,
  }
}
