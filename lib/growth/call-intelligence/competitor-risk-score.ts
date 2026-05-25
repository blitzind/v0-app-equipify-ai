import type { CallIntelligenceScoreInputs } from "@/lib/growth/call-intelligence/call-intelligence-types"

export function computeCompetitorRiskScore(input: CallIntelligenceScoreInputs): number {
  let score = 15
  score += Math.min(60, input.competitorPressureCount * 20)
  if (input.objectionCount >= 2) score += 10
  return clamp(score)
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
