import type {
  GrowthSearchIntentClassifiedSignal,
  GrowthSearchIntentScoreContribution,
  GrowthSearchIntentSourceType,
} from "@/lib/growth/search-intent/search-intent-types"

const CATEGORY_POINTS: Record<string, number> = {
  demo_intent: 8,
  pricing_research: 7,
  urgent_service_need: 8,
  vendor_comparison: 6,
  competitor_research: 6,
  purchase_ready: 0,
}

const SOURCE_CONFIDENCE: Record<GrowthSearchIntentSourceType, number> = {
  utm_keyword: 0.9,
  site_search: 0.88,
  paid_search: 0.85,
  organic_search: 0.75,
  content_path: 0.65,
  referrer_keyword: 0.45,
  manual_import: 0.7,
  future_provider: 0.4,
}

const HIGH_INTENT_PATHS = ["/pricing", "/demo", "/book", "/contact", "/service"]

function pathBoost(path: string | null | undefined): number {
  if (!path) return 0
  const p = path.toLowerCase()
  for (const segment of HIGH_INTENT_PATHS) {
    if (p.includes(segment)) return 4
  }
  if (p.includes("/compare") || p.includes("/vs")) return 3
  return 0
}

export function scoreSearchIntentSignal(signal: GrowthSearchIntentClassifiedSignal): number {
  let score = 0

  const categoryPoints = CATEGORY_POINTS[signal.intent_category] ?? 3
  score += categoryPoints

  if (signal.intent_strength === "high") score += 5
  else if (signal.intent_strength === "medium") score += 3
  else score += 1

  score += pathBoost(signal.matched_page_path)

  const confidence = SOURCE_CONFIDENCE[signal.source_type] ?? 0.5
  score = Math.round(score * (0.6 + confidence * 0.4))

  return Math.max(0, Math.min(100, score))
}

export function computeSearchIntentScoreContribution(
  signals: GrowthSearchIntentClassifiedSignal[],
  options?: { session_count?: number },
): GrowthSearchIntentScoreContribution {
  const reasons: string[] = []
  const breakdown: Record<string, number> = {}

  if (signals.length === 0) {
    return {
      points: 0,
      reasons: [],
      breakdown: {},
      top_category: null,
      top_keyword: null,
      signal_count: 0,
      max_confidence: 0,
    }
  }

  const scored = signals.map((s) => ({ ...s, intent_score: scoreSearchIntentSignal(s) }))
  const top = [...scored].sort((a, b) => b.intent_score - a.intent_score)[0]

  let points = Math.min(12, Math.round(top.intent_score / 8))
  breakdown.search_intent_top = points
  reasons.push(
    `Search intent: ${top.intent_category.replace(/_/g, " ")} (+${points}) from ${top.source_type}.`,
  )

  const comparisonSignals = scored.filter((s) =>
    ["vendor_comparison", "competitor_research"].includes(s.intent_category),
  )
  if (comparisonSignals.length > 0) {
    const bonus = 2
    breakdown.search_intent_comparison = bonus
    points += bonus
    reasons.push("Vendor/comparison intent signal (+2).")
  }

  const highPathSignals = scored.filter((s) => pathBoost(s.matched_page_path) >= 4)
  if (highPathSignals.length > 0 && !breakdown.search_intent_high_path) {
    const bonus = 3
    breakdown.search_intent_high_path = bonus
    points += bonus
    reasons.push("High-intent page path in search signal (+3).")
  }

  if ((options?.session_count ?? 1) > 1) {
    const bonus = 2
    breakdown.search_intent_repeat_visit = bonus
    points += bonus
    reasons.push("Repeat visits reinforce search intent (+2).")
  }

  const explicitUtm = scored.some((s) => s.source_type === "utm_keyword" && s.keyword)
  if (explicitUtm) {
    const bonus = 2
    breakdown.search_intent_utm_term = bonus
    points += bonus
    reasons.push("Explicit UTM term keyword (+2).")
  }

  points = Math.min(15, points)

  const max_confidence = Math.max(
    ...scored.map((s) => SOURCE_CONFIDENCE[s.source_type] ?? 0.5),
  )

  return {
    points,
    reasons,
    breakdown,
    top_category: top.intent_category,
    top_keyword: top.normalized_keyword || top.keyword || null,
    signal_count: signals.length,
    max_confidence: Number(max_confidence.toFixed(3)),
  }
}
