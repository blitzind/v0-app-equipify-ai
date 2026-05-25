export function applyCallIntelligenceToDealScoreInputs(input: {
  callOverallScore?: number | null
  callBuyingSignalScore?: number | null
  callCompetitorRiskScore?: number | null
  callNextStepScore?: number | null
  callOutcome?: string | null
  meetingCompletedWithHighScore?: boolean
}): {
  closeProbabilityBoost: number
  momentumBoost: number
  riskBoost: number
  confidenceBoost: number
} {
  let closeProbabilityBoost = 0
  let momentumBoost = 0
  let riskBoost = 0
  let confidenceBoost = 0

  if ((input.callBuyingSignalScore ?? 0) >= 60) closeProbabilityBoost += 6
  if ((input.callOverallScore ?? 0) >= 70 && input.callOutcome === "positive") closeProbabilityBoost += 5
  if ((input.callCompetitorRiskScore ?? 0) >= 50) riskBoost += 8
  if ((input.callNextStepScore ?? 0) < 45) momentumBoost -= 8
  else if ((input.callNextStepScore ?? 0) >= 70) momentumBoost += 6
  if (input.meetingCompletedWithHighScore) confidenceBoost += 8
  if ((input.callOverallScore ?? 0) >= 75) confidenceBoost += 4

  return { closeProbabilityBoost, momentumBoost, riskBoost, confidenceBoost }
}
