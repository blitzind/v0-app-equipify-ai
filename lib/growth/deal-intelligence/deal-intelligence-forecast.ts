import type { DealIntelligenceForecastAdjustment } from "@/lib/growth/deal-intelligence/deal-intelligence-types"

export function applyDealIntelligenceForecastAdjustment(input: {
  baseForecastConfidence: number
  averageDealForecastConfidence: number
  scoredOpportunities: number
  criticalRiskDeals: number
}): DealIntelligenceForecastAdjustment {
  if (input.scoredOpportunities === 0) {
    return {
      aiInformedForecastConfidence: input.baseForecastConfidence,
      baseForecastConfidence: input.baseForecastConfidence,
      scoredOpportunities: 0,
      riskAdjustedForecastNote: "No predictive deal scores yet — using deterministic forecast categories only.",
    }
  }

  const blend = Math.round(input.baseForecastConfidence * 0.65 + input.averageDealForecastConfidence * 0.35)
  const riskPenalty = Math.min(12, input.criticalRiskDeals * 2)
  const aiInformedForecastConfidence = Math.max(0, Math.min(100, blend - riskPenalty))

  const note =
    aiInformedForecastConfidence >= input.baseForecastConfidence
      ? `Deal intelligence supports forecast confidence (+${aiInformedForecastConfidence - input.baseForecastConfidence} pts vs base) across ${input.scoredOpportunities} scored opportunities.`
      : `Critical-risk deals adjusted forecast confidence (${aiInformedForecastConfidence}% vs ${input.baseForecastConfidence}% base) across ${input.scoredOpportunities} scored opportunities.`

  return {
    aiInformedForecastConfidence,
    baseForecastConfidence: input.baseForecastConfidence,
    scoredOpportunities: input.scoredOpportunities,
    riskAdjustedForecastNote: note,
  }
}
