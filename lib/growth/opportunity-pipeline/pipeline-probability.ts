import type { GrowthOpportunityStageKey } from "@/lib/growth/opportunity-pipeline/pipeline-types"

export const DEFAULT_STAGE_PROBABILITY: Record<GrowthOpportunityStageKey, number> = {
  new_opportunity: 10,
  discovery: 20,
  qualified: 40,
  proposal: 60,
  negotiation: 75,
  verbal_commit: 90,
  closed_won: 100,
  closed_lost: 0,
}

export function resolveGrowthOpportunityStageProbability(
  stageKey: GrowthOpportunityStageKey,
  overrides?: Partial<Record<GrowthOpportunityStageKey, number>>,
): number {
  const override = overrides?.[stageKey]
  if (override != null) return Math.min(100, Math.max(0, Math.round(override)))
  return DEFAULT_STAGE_PROBABILITY[stageKey]
}

export function computeGrowthOpportunityWeightedAmount(amount: number, probability: number): number {
  return Math.round(amount * (probability / 100) * 100) / 100
}
