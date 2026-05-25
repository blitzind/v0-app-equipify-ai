import type { CallIntelligenceScoreInputs } from "@/lib/growth/call-intelligence/call-intelligence-types"

export function computeObjectionHandlingScore(input: CallIntelligenceScoreInputs): number {
  let score = 70
  score -= Math.min(40, input.objectionCount * 12)
  if (input.executionScore != null && input.executionScore >= 70) score += 8
  if (input.acceptedGuidanceCount > 0) score += Math.min(10, input.acceptedGuidanceCount * 2)
  return clamp(score)
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
