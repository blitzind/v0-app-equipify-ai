/** GE-AIOS-NEXT-3D — Fire-and-forget client mirror of operator decisions to server memory. */

import { GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_API_PATH } from "./growth-home-ava-operator-decision-memory-next-3d"
import type { GrowthHomeAvaOperatorDecisionType } from "./growth-home-ava-recommendation-accountability-next-3d-types"
import type { GrowthHomeAvaRecommendationKind } from "./growth-home-ava-recommendation-next-1a-types"

export async function mirrorGrowthHomeAvaOperatorDecisionToServer(input: {
  decisionType: GrowthHomeAvaOperatorDecisionType
  recommendationTopic?: string | null
  recommendationKind?: GrowthHomeAvaRecommendationKind | null
  recommendationId?: string | null
}): Promise<void> {
  if (typeof window === "undefined") return

  try {
    await fetch(GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      keepalive: true,
    })
  } catch {
    // Non-blocking — browser preference memory remains the immediate UX source.
  }
}
