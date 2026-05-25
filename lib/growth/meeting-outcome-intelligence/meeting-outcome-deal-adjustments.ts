export function applyMeetingOutcomeToDealScoreInputs(input: {
  meetingOutcomeScore?: number | null
  meetingQualityScore?: number | null
  nextStepConfidence?: number | null
  followUpRecommendation?: string | null
  buyingSignalCount?: number
  noShowRiskPattern?: boolean
}): {
  closeProbabilityBoost: number
  closeProbabilityPenalty: number
  momentumBoost: number
  riskBoost: number
} {
  let closeProbabilityBoost = 0
  let closeProbabilityPenalty = 0
  let momentumBoost = 0
  let riskBoost = 0

  if ((input.meetingOutcomeScore ?? 0) >= 75) closeProbabilityBoost += 6
  if ((input.meetingQualityScore ?? 0) >= 70) closeProbabilityBoost += 4
  if (input.followUpRecommendation === "strong_opportunity") closeProbabilityBoost += 5
  if (input.followUpRecommendation === "send_proposal_recommendation") closeProbabilityBoost += 3
  if ((input.nextStepConfidence ?? 0) >= 70) momentumBoost += 6
  if ((input.buyingSignalCount ?? 0) >= 2) momentumBoost += 4

  if (input.followUpRecommendation === "risk_of_stall") {
    closeProbabilityPenalty += 6
    riskBoost += 8
  }
  if (input.followUpRecommendation === "no_show_recovery" || input.noShowRiskPattern) {
    closeProbabilityPenalty += 8
    riskBoost += 10
  }
  if ((input.nextStepConfidence ?? 100) < 40) {
    momentumBoost -= 8
    riskBoost += 5
  }

  return { closeProbabilityBoost, closeProbabilityPenalty, momentumBoost, riskBoost }
}

export function applyMeetingOutcomeToExecutionPriority(input: {
  meetingQualityScore?: number | null
  meetingOutcomeScore?: number | null
  followUpRecommendation?: string | null
}): number {
  let weight = 0
  if ((input.meetingQualityScore ?? 0) >= 70) weight += 4
  if ((input.meetingOutcomeScore ?? 0) >= 75) weight += 5
  if (input.followUpRecommendation === "risk_of_stall") weight += 8
  if (input.followUpRecommendation === "no_show_recovery") weight += 10
  if (input.followUpRecommendation === "strong_opportunity") weight += 6
  return weight
}
