/** Objection stage mapping — Phase 3B. */

import type { VoiceObjectionStageMapping } from "@/lib/voice/copilot-strategy/types"

export function mapObjectionStage(input: {
  objectionEvents: Array<{ evidenceText: string; title: string }>
  transcriptTexts: string[]
}): VoiceObjectionStageMapping {
  const count = input.objectionEvents.length
  const combined = [...input.transcriptTexts, ...input.objectionEvents.map((e) => e.evidenceText)].join(" ")

  if (count === 0) {
    return {
      stage: "resolved",
      confidenceScore: 0.6,
      evidenceText: "No active objection signals in current window.",
      activeObjectionCount: 0,
    }
  }

  const addressing = /\b(understand|fair point|let me explain|here's how|value|compared to)\b/i.test(combined)
  const resolved = /\b(that makes sense|sounds good|okay|got it|fair enough)\b/i.test(combined)
  const exploring = /\b(tell me more|what specifically|help me understand why)\b/i.test(combined)

  if (resolved && count <= 1) {
    return {
      stage: "resolved",
      confidenceScore: 0.75,
      evidenceText: combined.slice(0, 160),
      activeObjectionCount: count,
    }
  }
  if (addressing) {
    return {
      stage: "addressing",
      confidenceScore: 0.8,
      evidenceText: input.objectionEvents[0]?.evidenceText ?? combined.slice(0, 160),
      activeObjectionCount: count,
    }
  }
  if (exploring) {
    return {
      stage: "exploring",
      confidenceScore: 0.78,
      evidenceText: input.objectionEvents[0]?.evidenceText ?? combined.slice(0, 160),
      activeObjectionCount: count,
    }
  }

  return {
    stage: count >= 2 ? "unresolved" : "surfaced",
    confidenceScore: 0.72,
    evidenceText: input.objectionEvents[0]?.evidenceText ?? combined.slice(0, 160),
    activeObjectionCount: count,
  }
}
