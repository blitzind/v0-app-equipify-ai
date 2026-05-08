/**
 * AI Ops Phase 5 — deterministic, explainable command-center scoring.
 *
 * Combines rule priority with lifecycle state and simple staleness from
 * `anchorIso`. No ML — every point bucket includes a human-readable label.
 */

import type {
  Recommendation,
  RecommendationLifecycleState,
  RecommendationScoreBreakdownEntry,
} from "./types"

const PRIORITY_POINTS: Record<Recommendation["priority"], number> = {
  high: 100,
  medium: 55,
  low: 25,
}

const LIFECYCLE_POINTS: Record<RecommendationLifecycleState, number> = {
  pending: 0,
  acknowledged: 6,
  in_progress: 14,
  escalated: 22,
  ignored: -8,
  completed: -40,
}

export function computeCommandScore(
  rec: Recommendation,
  lifecycleState: RecommendationLifecycleState | undefined,
): { score: number; breakdown: RecommendationScoreBreakdownEntry[] } {
  const breakdown: RecommendationScoreBreakdownEntry[] = []
  const p = PRIORITY_POINTS[rec.priority]
  breakdown.push({ label: `Priority (${rec.priority})`, points: p })

  const life = lifecycleState ?? "pending"
  const lp = LIFECYCLE_POINTS[life]
  breakdown.push({ label: `Lifecycle (${life.replace("_", " ")})`, points: lp })

  let staleness = 0
  if (rec.anchorIso) {
    const anchor = new Date(rec.anchorIso).getTime()
    if (!Number.isNaN(anchor)) {
      const days = Math.floor((Date.now() - anchor) / (24 * 60 * 60 * 1000))
      if (days > 0) {
        staleness = Math.min(days, 21)
        breakdown.push({ label: `Staleness (up to 21 days)`, points: staleness })
      }
    }
  }

  const score = breakdown.reduce((s, b) => s + b.points, 0)
  return { score, breakdown }
}

const PRIORITY_ORDER: Record<Recommendation["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
}

/**
 * Sort recommendations for the command center: strict priority bands first,
 * then descending command score within each band.
 */
export function sortRecommendationsForCommandCenter(items: Recommendation[]): Recommendation[] {
  const decorated = items.map((item, index) => ({
    item,
    index,
    pr: PRIORITY_ORDER[item.priority],
    score: item.commandScore ?? 0,
  }))
  decorated.sort((a, b) => {
    if (a.pr !== b.pr) return a.pr - b.pr
    if (a.score !== b.score) return b.score - a.score
    const aA = a.item.anchorIso ?? ""
    const bA = b.item.anchorIso ?? ""
    if (aA && bA) return aA < bA ? -1 : 1
    return a.index - b.index
  })
  return decorated.map((d) => d.item)
}
