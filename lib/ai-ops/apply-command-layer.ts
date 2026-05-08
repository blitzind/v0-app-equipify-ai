/**
 * AI Ops Phase 5 — merge deterministic recommendations with lifecycle rows,
 * compute explainable scores, and sort for the command center list view.
 */

import type { Recommendation, RecommendationLifecycleState } from "./types"
import { computeCommandScore, sortRecommendationsForCommandCenter } from "./command-score"
import type { LifecycleRow } from "./lifecycle-db"

export function applyLifecycleScoresAndSort(
  items: Recommendation[],
  lifecycleByKey: Map<string, LifecycleRow>,
): Recommendation[] {
  const enriched = items.map((rec) => {
    const row = lifecycleByKey.get(rec.key)
    const state = (row?.state as RecommendationLifecycleState | undefined) ?? "pending"
    const { score, breakdown } = computeCommandScore(rec, state)
    return {
      ...rec,
      lifecycleState: state,
      commandScore: score,
      commandScoreBreakdown: breakdown,
    }
  })
  return sortRecommendationsForCommandCenter(enriched)
}
