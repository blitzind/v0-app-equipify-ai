import type {
  GrowthIntentLeadCandidateGrade,
  GrowthIntentLeadCandidatePriority,
} from "@/lib/growth/lead-engine/intent/intent-candidate-types"
import type { GrowthIntentAggregatedSession } from "@/lib/growth/lead-engine/intent/intent-session-aggregator"

export const GROWTH_INTENT_HIGH_INTENT_PATHS = [
  "/pricing",
  "/demo",
  "/book",
  "/contact",
  "/product",
  "/service",
] as const

export const GROWTH_INTENT_SCORE_PAGE_DEPTH_TIERS = [
  { min_pages: 5, points: 5 },
  { min_pages: 3, points: 3 },
  { min_pages: 1, points: 1 },
] as const

export const GROWTH_INTENT_SCORE_TIME_MS_TIERS = [
  { min_ms: 180_000, points: 5 },
  { min_ms: 90_000, points: 3 },
  { min_ms: 30_000, points: 1 },
] as const

export type GrowthIntentScoreBreakdown = Record<string, number>

export type GrowthIntentScoreResult = {
  intent_score: number
  intent_grade: GrowthIntentLeadCandidateGrade
  candidate_priority: GrowthIntentLeadCandidatePriority
  scoring_breakdown: GrowthIntentScoreBreakdown
  reasoning: string[]
}

function pathMatchesHighIntent(path: string): boolean {
  const normalized = path.toLowerCase().split("?")[0] ?? ""
  return GROWTH_INTENT_HIGH_INTENT_PATHS.some(
    (segment) => normalized === segment || normalized.startsWith(`${segment}/`),
  )
}

function scorePageDepth(uniquePageCount: number): { points: number; reason: string | null } {
  for (const tier of GROWTH_INTENT_SCORE_PAGE_DEPTH_TIERS) {
    if (uniquePageCount >= tier.min_pages) {
      return {
        points: tier.points,
        reason: `Page depth: ${uniquePageCount} unique page(s) (+${tier.points}).`,
      }
    }
  }
  return { points: 0, reason: null }
}

function scoreTimeOnSite(totalMs: number): { points: number; reason: string | null } {
  for (const tier of GROWTH_INTENT_SCORE_TIME_MS_TIERS) {
    if (totalMs >= tier.min_ms) {
      const seconds = Math.round(totalMs / 1000)
      return {
        points: tier.points,
        reason: `Time on site: ${seconds}s (+${tier.points}).`,
      }
    }
  }
  return { points: 0, reason: null }
}

function scoreConversions(aggregated: GrowthIntentAggregatedSession): {
  points: number
  reasons: string[]
} {
  const reasons: string[] = []
  let points = 0

  for (const conversion of aggregated.all_conversions) {
    const label = conversion.conversion_label.toLowerCase()
    const type = conversion.conversion_type

    if (type === "form_submit" || label.includes("contact")) {
      points += 8
      reasons.push("Conversion: contact form (+8).")
    } else if (type === "booking" || label.includes("demo") || label.includes("book")) {
      points += 10
      reasons.push("Conversion: book demo (+10).")
    } else if (type === "lead_capture") {
      points += 7
      reasons.push("Conversion: lead capture (+7).")
    } else if (type === "custom" && label.includes("pricing")) {
      points += 6
      reasons.push("Conversion: pricing interest (+6).")
    } else {
      points += 3
      reasons.push(`Conversion: ${type} (+3).`)
    }
  }

  return { points, reasons }
}

function scoreHighIntentPaths(aggregated: GrowthIntentAggregatedSession): {
  points: number
  reasons: string[]
} {
  const matched = new Set<string>()
  for (const pv of aggregated.all_pageviews) {
    const path = pv.page_path || pv.page_url
    for (const segment of GROWTH_INTENT_HIGH_INTENT_PATHS) {
      if (pathMatchesHighIntent(path) && path.toLowerCase().includes(segment)) {
        matched.add(segment)
      }
    }
  }

  const points = matched.size * 4
  const reasons = [...matched].map((p) => `High-intent path ${p} (+4).`)
  return { points, reasons }
}

function scoreUtm(aggregated: GrowthIntentAggregatedSession): { points: number; reason: string | null } {
  const utm = aggregated.primary_session.last_touch_utm
  const source = utm.utm_source.trim()
  const medium = utm.utm_medium.trim()
  const campaign = utm.utm_campaign.trim()
  if (!source && !medium && !campaign) return { points: 0, reason: null }

  let points = 2
  if (source) points += 1
  if (medium === "cpc" || medium === "paid") points += 2
  if (campaign) points += 1

  return {
    points,
    reason: `UTM attribution: ${[source, medium, campaign].filter(Boolean).join(" / ")} (+${points}).`,
  }
}

export function computeIntentCandidateScore(
  aggregated: GrowthIntentAggregatedSession,
): GrowthIntentScoreResult {
  const breakdown: GrowthIntentScoreBreakdown = {}
  const reasoning: string[] = []

  const depth = scorePageDepth(aggregated.unique_page_count)
  if (depth.points > 0) {
    breakdown.page_depth = depth.points
    if (depth.reason) reasoning.push(depth.reason)
  }

  const time = scoreTimeOnSite(aggregated.total_time_on_site_ms)
  if (time.points > 0) {
    breakdown.time_on_site = time.points
    if (time.reason) reasoning.push(time.reason)
  }

  const conversions = scoreConversions(aggregated)
  if (conversions.points > 0) {
    breakdown.conversions = conversions.points
    reasoning.push(...conversions.reasons)
  }

  const paths = scoreHighIntentPaths(aggregated)
  if (paths.points > 0) {
    breakdown.high_intent_paths = paths.points
    reasoning.push(...paths.reasons)
  }

  if (aggregated.visit_history.session_count > 1) {
    breakdown.multiple_visits = 3
    reasoning.push(`Multiple visits: ${aggregated.visit_history.session_count} sessions (+3).`)
    breakdown.repeat_sessions = 2
    reasoning.push("Repeat sessions (+2).")
  }

  if (aggregated.identified_contacts.length > 0) {
    breakdown.identified_contact = 8
    reasoning.push("Identified contact from explicit capture (+8).")
  }

  const utm = scoreUtm(aggregated)
  if (utm.points > 0) {
    breakdown.utm = utm.points
    if (utm.reason) reasoning.push(utm.reason)
  }

  const intent_score = Object.values(breakdown).reduce((sum, v) => sum + v, 0)

  let intent_grade: GrowthIntentLeadCandidateGrade = "F"
  if (intent_score >= 20) intent_grade = "A"
  else if (intent_score >= 15) intent_grade = "B"
  else if (intent_score >= 10) intent_grade = "C"
  else if (intent_score >= 5) intent_grade = "D"

  let candidate_priority: GrowthIntentLeadCandidatePriority = "low"
  if (aggregated.identified_contacts.length > 0 && intent_score >= 15) {
    candidate_priority = "urgent"
  } else if (intent_score >= 18 || conversions.points >= 10) {
    candidate_priority = "urgent"
  } else if (intent_score >= 12) {
    candidate_priority = "high"
  } else if (intent_score >= 6) {
    candidate_priority = "normal"
  }

  return {
    intent_score,
    intent_grade,
    candidate_priority,
    scoring_breakdown: breakdown,
    reasoning,
  }
}

export function normalizeCandidateConfidence(intentScore: number, hasEvidence: boolean): number {
  const base = Math.min(1, intentScore / 25)
  const evidenceBoost = hasEvidence ? 0.1 : 0
  return Number(Math.max(0, Math.min(1, base + evidenceBoost)).toFixed(3))
}
