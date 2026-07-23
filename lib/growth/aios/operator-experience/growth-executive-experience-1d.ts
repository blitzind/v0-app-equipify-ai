/**
 * AVA-GROWTH-OPERATOR-1D — Executive experience alignment (client-safe).
 * One executive voice, one reasoning surface label, portfolio-first language helpers.
 */

import {
  humanizeOperatorFacingLine,
  stripInternalEngineTerms,
} from "@/lib/growth/aios/operator-experience/growth-operator-language-1a"
import type { GrowthHomeAvaRecommendationItem } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"

export const GROWTH_AIOS_GROWTH_OPERATOR_1D_QA_MARKER =
  "ava-growth-operator-1d-executive-experience-v1" as const

export const GROWTH_EXECUTIVE_EXPERIENCE_RULE =
  "presentation-only: executive copy and dedupe; no new recommendation authority" as const

/** R4 — one consistent expandable reasoning surface label across operator surfaces. */
export const GROWTH_EXECUTIVE_SHOW_AVA_WORK_LABEL = "Show Ava's Work" as const

/** R1 — Home executive briefing answers these in order. */
export const GROWTH_EXECUTIVE_HOME_SECTION_ORDER = [
  "accomplishments",
  "current_mission",
  "recommendations",
  "approvals_waiting",
  "blockers",
  "strategic_observations",
] as const

export type GrowthExecutiveConfidenceBand = "high" | "moderate" | "low"

const EXECUTIVE_TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bwaiting\b/gi, "ready for your review"],
  [/\bpending\b/gi, "in progress"],
  [/\bpipeline stage\b/gi, "portfolio stage"],
  [/\bworkflow state\b/gi, "status"],
  [/\bworkflow\b/gi, "process"],
  [/\bsubsystem\b/gi, ""],
  [/\bpilot\b/gi, ""],
  [/\bengine\b/gi, ""],
  [/\btransport\b/gi, "outreach send"],
  [/\bsend plane\b/gi, "outreach send"],
  [/\boperator review required\b/gi, "I need your approval"],
  [/\bawaiting operator\b/gi, "I need your approval"],
  [/\bcanonical decision\b/gi, "my recommendation"],
  [/\bmaterialization\b/gi, "preparation"],
  [/\bqualification:\s*\w+/gi, "account review"],
  [/\(\s*\d+\s*%\s*confidence\s*\)/gi, ""],
  [/\b\d+\s*%\s*confidence\b/gi, ""],
  [/\b\d+\s*%\s*complete\b/gi, "in progress"],
]

const RECOMMENDATION_KIND_PRIORITY: Record<GrowthHomeAvaRecommendationItem["kind"], number> = {
  approval_package: 1,
  lead_decision: 2,
  operator_focus: 3,
  waiting_on_you: 4,
  work_manager: 5,
  daily_queue: 6,
  supervised_sales: 7,
  mission_discovery: 8,
}

export function formatExecutiveConfidenceBand(
  confidence: number | null | undefined,
): GrowthExecutiveConfidenceBand {
  const value = typeof confidence === "number" ? confidence : 0
  const normalized = value > 1 ? value / 100 : value
  if (normalized >= 0.65) return "high"
  if (normalized >= 0.4) return "moderate"
  return "low"
}

export function formatExecutiveConfidenceLabel(
  confidence: number | null | undefined,
): string {
  const band = formatExecutiveConfidenceBand(confidence)
  if (band === "high") return "High confidence"
  if (band === "moderate") return "Moderate confidence"
  return "Limited confidence"
}

export function humanizeExecutiveCopy(value: string | null | undefined): string {
  const base = humanizeOperatorFacingLine(value)
  if (!base) return ""

  let next = base
  for (const [pattern, replacement] of EXECUTIVE_TERM_REPLACEMENTS) {
    next = next.replace(pattern, replacement)
  }
  return stripInternalEngineTerms(next).replace(/\s{2,}/g, " ").trim()
}

export function buildExecutiveResearchProgressLine(input: {
  confidencePercent?: number | null
  detail?: string | null
}): string | null {
  const percent = input.confidencePercent
  if (typeof percent === "number" && percent > 0 && percent < 100) {
    const band = formatExecutiveConfidenceBand(percent / 100)
    if (band === "high") return "I've completed most of my research on this account."
    if (band === "moderate") return "I'm still researching this account."
    return "I'm early in my research on this account."
  }
  const detail = humanizeExecutiveCopy(input.detail)
  if (detail && /research|qualif|progress|complete/i.test(detail)) {
    return detail
  }
  return null
}

function recommendationLeadKey(item: GrowthHomeAvaRecommendationItem): string | null {
  return item.leadId?.trim() || null
}

/**
 * R1/R7 — one primary recommendation per lead; approval packages win over decision/focus duplicates.
 */
export function alignExecutiveHomeRecommendations(
  items: GrowthHomeAvaRecommendationItem[],
): GrowthHomeAvaRecommendationItem[] {
  const byLead = new Map<string, GrowthHomeAvaRecommendationItem>()
  const leadless: GrowthHomeAvaRecommendationItem[] = []

  for (const item of items.sort((left, right) => left.rank - right.rank)) {
    const leadId = recommendationLeadKey(item)
    if (!leadId) {
      leadless.push(item)
      continue
    }

    const existing = byLead.get(leadId)
    if (!existing) {
      byLead.set(leadId, item)
      continue
    }

    const existingPriority = RECOMMENDATION_KIND_PRIORITY[existing.kind] ?? 99
    const nextPriority = RECOMMENDATION_KIND_PRIORITY[item.kind] ?? 99
    if (nextPriority < existingPriority) {
      byLead.set(leadId, item)
    }
  }

  const merged = [...byLead.values(), ...leadless].sort((left, right) => left.rank - right.rank)

  return merged.map((item, index) => ({
    ...item,
    rank: index + 1,
    title: humanizeExecutiveCopy(item.title) || item.title,
    headline: humanizeExecutiveCopy(item.headline) || item.headline,
    detail: item.detail ? humanizeExecutiveCopy(item.detail) : item.detail,
    supportingLine: item.supportingLine ? humanizeExecutiveCopy(item.supportingLine) : item.supportingLine,
    outcomeLine: item.outcomeLine ? humanizeExecutiveCopy(item.outcomeLine) : item.outcomeLine,
  }))
}

/** R5 — portfolio-first metric labels (operator-facing). */
export const GROWTH_EXECUTIVE_PORTFOLIO_METRIC_LABELS = {
  companiesEvaluated: "Companies evaluated",
  rejectedAutomatically: "Rejected automatically",
  activelyResearching: "Actively researching",
  preparedOpportunities: "Prepared opportunities",
  recommendedOpportunities: "Recommended opportunities",
  approvedOutreach: "Approved outreach",
  activeConversations: "Active conversations",
  meetingsScheduled: "Meetings scheduled",
  growthPipeline: "Growth pipeline",
  portfolioHealth: "Portfolio health",
  discovery: "Finding companies",
  admissionsReview: "Accounts I'm qualifying",
} as const
