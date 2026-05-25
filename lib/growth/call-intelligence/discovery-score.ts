import type { CallIntelligenceScoreInputs } from "@/lib/growth/call-intelligence/call-intelligence-types"

export function computeDiscoveryScore(input: CallIntelligenceScoreInputs): number {
  let score = input.discoveryCoveragePercent
  score -= Math.min(30, input.discoveryGapCount * 8)
  if (input.meetingCompleted && score >= 60) score += 5
  return clamp(score)
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
