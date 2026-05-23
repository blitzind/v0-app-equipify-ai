import type { GrowthDecisionMakerSource } from "@/lib/growth/decision-maker-types"

/** Source weighting for ranking/merging decision maker candidates (higher wins). */
export const GROWTH_DECISION_MAKER_SOURCE_WEIGHT: Record<GrowthDecisionMakerSource, number> = {
  manual: 100,
  apollo: 90,
  seamless: 90,
  lead_contact: 70,
  website: 50,
  public_web: 40,
}

export function decisionMakerCandidateScore(input: {
  source: GrowthDecisionMakerSource
  confidence: number | null
}): number {
  const weight = GROWTH_DECISION_MAKER_SOURCE_WEIGHT[input.source]
  const confidence = input.confidence ?? 0.5
  return weight * confidence
}
