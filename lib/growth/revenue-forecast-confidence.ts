import type { GrowthLeadRevenueForecastInput } from "@/lib/growth/revenue-forecast-types"

function clampConfidence(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function computeRevenueForecastConfidence(input: GrowthLeadRevenueForecastInput): number {
  let confidence = 30

  if (input.hasUsableResearch) confidence += 10
  if ((input.researchConfidence ?? 0) >= 0.6) confidence += 15
  else if ((input.researchConfidence ?? 0) >= 0.4) confidence += 8

  const cachesComputed = [
    input.engagementComputedAt,
    input.relationshipComputedAt,
    input.opportunityReadinessComputedAt,
  ].filter(Boolean).length
  if (cachesComputed >= 3) confidence += 10
  else if (cachesComputed >= 2) confidence += 5

  if (input.opportunityAcceleratorCount >= 2) confidence += 8
  if (
    input.decisionMakerStatus === "confirmed" ||
    input.decisionMakerStatus === "verified_contactable"
  ) {
    confidence += 10
  }

  if (input.hasPositiveReply && input.connectedCallCount > 0) confidence += 10
  else if (input.hasPositiveReply || input.connectedCallCount > 0) confidence += 5

  if (input.opportunityReadinessConfidence >= 60) confidence += 8
  else if (input.opportunityReadinessConfidence < 40) confidence -= 10

  if (!input.hasUsableResearch) confidence -= 20
  if (input.opportunityBlockerKeys.length >= 3) confidence -= 15
  if (
    !input.engagementScore &&
    !input.relationshipStrengthScore &&
    !input.opportunityReadinessScore
  ) {
    confidence -= 15
  }

  return clampConfidence(confidence)
}
