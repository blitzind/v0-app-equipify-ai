/**
 * AI Ops Phase 4 — outcome-aware ranking.
 *
 * Reads the last 30 days of `ai_ops_outcomes` and applies a small
 * score adjustment to recommendation ordering — promoting categories
 * the team consistently acts on, gently demoting categories the team
 * routinely dismisses. The deterministic engine remains the source
 * of truth: this module only **reorders** items, never adds, hides,
 * or modifies a recommendation.
 *
 * Hard guarantees:
 *   1. High-priority items are NEVER demoted below medium-priority
 *      items, regardless of past dismissals. Outcome-aware ranking
 *      is a tie-breaker within a priority bucket only.
 *   2. The adjustment is bounded to ±0.4 score points so a single
 *      streak can't override priority entirely.
 *   3. With fewer than `MIN_SAMPLES` outcome rows in the lookback
 *      window the helper is a no-op — premature ranking on sparse
 *      data is worse than no ranking.
 *   4. The helper never reaches into source tables; it relies
 *      entirely on `ai_ops_outcomes` which has a strict insert-only
 *      RLS policy.
 *
 * The math is intentionally simple and explainable:
 *
 *   actedRatio    = actedOn / (actedOn + dismissed + snoozed)
 *   dismissRatio  = (dismissed + snoozed * 0.5) / total
 *   adjustment    = clamp(actedRatio - dismissRatio, -0.4, +0.4)
 *
 * Items are sorted by:
 *   1. priority (high → low) — strict
 *   2. category adjustment (descending)
 *   3. anchor (oldest first) — original tie-breaker
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  Recommendation,
  RecommendationCategory,
  RecommendationPriority,
} from "./types"

const PRIORITY_RANK: Record<RecommendationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const LOOKBACK_DAYS = 30
const MIN_SAMPLES = 10
const MAX_ADJUSTMENT = 0.4

export type CategoryAdjustments = Partial<Record<RecommendationCategory, number>>

export type OutcomeStats = {
  windowDays: number
  totalSamples: number
  byCategory: Partial<
    Record<
      RecommendationCategory,
      {
        actedOn: number
        dismissed: number
        snoozed: number
        drafted: number
        adjustment: number
      }
    >
  >
}

export async function computeCategoryAdjustments(
  supabase: SupabaseClient,
  organizationId: string,
  now: Date = new Date(),
): Promise<{ adjustments: CategoryAdjustments; stats: OutcomeStats }> {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from("ai_ops_outcomes")
    .select("category, outcome")
    .eq("organization_id", organizationId)
    .gte("created_at", since)
    .limit(2000)

  const stats: OutcomeStats = {
    windowDays: LOOKBACK_DAYS,
    totalSamples: 0,
    byCategory: {},
  }
  if (error || !data) return { adjustments: {}, stats }

  for (const row of data as Array<{ category: string; outcome: string }>) {
    const cat = row.category as RecommendationCategory
    const bucket =
      stats.byCategory[cat] ??
      (stats.byCategory[cat] = { actedOn: 0, dismissed: 0, snoozed: 0, drafted: 0, adjustment: 0 })
    if (row.outcome === "acted_on") bucket.actedOn += 1
    else if (row.outcome === "dismissed") bucket.dismissed += 1
    else if (row.outcome === "snoozed") bucket.snoozed += 1
    else if (row.outcome === "drafted_followup") bucket.drafted += 1
    stats.totalSamples += 1
  }

  if (stats.totalSamples < MIN_SAMPLES) {
    return { adjustments: {}, stats }
  }

  const adjustments: CategoryAdjustments = {}
  for (const [category, bucket] of Object.entries(stats.byCategory) as Array<
    [RecommendationCategory, NonNullable<OutcomeStats["byCategory"][RecommendationCategory]>]
  >) {
    const denom = bucket.actedOn + bucket.dismissed + bucket.snoozed
    if (denom === 0) {
      bucket.adjustment = 0
      continue
    }
    const acted = bucket.actedOn / denom
    const dismissed = (bucket.dismissed + bucket.snoozed * 0.5) / denom
    const raw = acted - dismissed
    const clamped = Math.max(-MAX_ADJUSTMENT, Math.min(MAX_ADJUSTMENT, raw))
    bucket.adjustment = clamped
    adjustments[category] = clamped
  }

  return { adjustments, stats }
}

/**
 * Reorders items inside each priority bucket using `adjustments`.
 * Strict priority ordering is preserved — see module-level docs.
 */
export function applyOutcomeAwareRanking(
  items: Recommendation[],
  adjustments: CategoryAdjustments,
): Recommendation[] {
  if (!items.length) return items
  if (Object.keys(adjustments).length === 0) return items

  const decorated = items.map((item, index) => ({
    item,
    index,
    priorityRank: PRIORITY_RANK[item.priority],
    adjustment: adjustments[item.category] ?? 0,
  }))

  decorated.sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank
    if (a.adjustment !== b.adjustment) return b.adjustment - a.adjustment
    const aAnchor = a.item.anchorIso ?? ""
    const bAnchor = b.item.anchorIso ?? ""
    if (aAnchor && bAnchor) return aAnchor < bAnchor ? -1 : 1
    if (aAnchor) return -1
    if (bAnchor) return 1
    return a.index - b.index
  })

  return decorated.map((d) => d.item)
}
