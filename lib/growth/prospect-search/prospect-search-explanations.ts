/** Deterministic Prospect Search score/confidence explanations (Sprint 5). Client-safe. */

import type { GrowthProspectSearchParsedQuery } from "@/lib/growth/prospect-search/prospect-search-types"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"
import { evaluateTerritoryMatch } from "@/lib/growth/prospect-search/prospect-search-geo"

export const GROWTH_PROSPECT_SEARCH_EXPLANATIONS_QA_MARKER =
  "growth-prospect-search-explanations-v1" as const

export type ProspectSearchExplanationBundle = {
  score_explanation_items: string[]
  confidence_explanation_items: string[]
  recommended_next_step_reason: string | null
}

function includesFold(hay: string | null | undefined, needle: string): boolean {
  if (!hay || !needle) return false
  return hay.toLowerCase().includes(needle.toLowerCase())
}

function normalizeDomain(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const raw = value.trim().toLowerCase()
  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`)
    return url.hostname.replace(/^www\./, "") || null
  } catch {
    return raw.replace(/^www\./, "").split("/")[0] || null
  }
}

function uniqueItems(items: string[], limit = 6): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, limit)
}

export function buildProspectSearchExplanations(input: {
  row: Pick<
    GrowthProspectSearchCompanyResult,
    | "company_name"
    | "website"
    | "industry"
    | "location"
    | "city"
    | "state"
    | "postal_code"
    | "country"
    | "metro"
    | "lat"
    | "lng"
    | "service_area"
    | "signals"
    | "match_reasoning"
    | "rank_score"
    | "confidence"
    | "signal_confidence"
    | "lead_engine_score"
    | "lead_engine_score_explanation"
    | "lead_score"
    | "buying_stage"
    | "buying_stage_reason"
    | "intent_score"
    | "search_intent_category"
    | "company_match_confidence"
    | "crm_detected"
    | "field_service_software"
    | "website_platform"
    | "company_signal_summary"
    | "existing_customer"
    | "existing_prospect"
    | "in_lead_inbox"
    | "is_suppressed"
    | "suppression_reason"
    | "source_type"
  >
  query?: string
  filters?: GrowthProspectSearchFilters
  parsed?: GrowthProspectSearchParsedQuery
}): ProspectSearchExplanationBundle {
  const { row, query = "", filters, parsed } = input
  const scoreItems: string[] = []
  const confidenceItems: string[] = []

  const blob = [
    row.company_name,
    row.website,
    row.industry,
    row.location,
    ...row.signals,
  ]
    .filter(Boolean)
    .join(" ")

  if (query.trim() && includesFold(blob, query.trim())) {
    scoreItems.push("Strong ICP keyword match to your search query.")
  } else if (parsed?.keywords.length) {
    const hits = parsed.keywords.filter((kw) => includesFold(blob, kw))
    if (hits.length) scoreItems.push(`Matches search keywords: ${hits.slice(0, 3).join(", ")}.`)
  }

  if (filters?.industry && row.industry && includesFold(row.industry, filters.industry)) {
    scoreItems.push(`Matches selected industry (${filters.industry}).`)
  } else if (parsed?.industry_hints.length && row.industry) {
    const hit = parsed.industry_hints.find((hint) => includesFold(row.industry, hint))
    if (hit) scoreItems.push(`Industry aligns with search (${hit}).`)
  }

  if (filters?.location && includesFold([row.location, row.city, row.state].filter(Boolean).join(" "), filters.location)) {
    scoreItems.push(`Matches location filter (${filters.location}).`)
  }

  if (filters?.territory_filter) {
    const territoryMatch = evaluateTerritoryMatch(
      {
        city: row.city,
        state: row.state,
        postal_code: row.postal_code,
        country: row.country,
        location: row.location,
        service_area: row.service_area,
        metro: row.metro,
        lat: row.lat,
        lng: row.lng,
      },
      filters.territory_filter,
    )
    for (const reason of territoryMatch.reasons.slice(0, 3)) {
      if (!scoreItems.includes(reason)) scoreItems.push(reason)
    }
  } else if (parsed?.location_hints.length) {
    const locBlob = [row.location, row.city, row.state, row.service_area].filter(Boolean).join(" ")
    const hit = parsed.location_hints.find((hint) => includesFold(locBlob, hint))
    if (hit) scoreItems.push(`Location aligns with search (${hit}).`)
  }

  if (row.crm_detected) scoreItems.push(`CRM software detected (${row.crm_detected}).`)
  if (row.field_service_software) {
    scoreItems.push(`Field service software detected (${row.field_service_software}).`)
  }
  if (row.website_platform) scoreItems.push(`Website platform detected (${row.website_platform}).`)

  const summary = row.company_signal_summary
  if (summary?.technology_signals[0]) {
    scoreItems.push(`Technology signal: ${summary.technology_signals[0]}.`)
  }
  if (summary?.growth_indicators[0]) {
    scoreItems.push(`Growth signal: ${summary.growth_indicators[0]}.`)
  }

  if (row.lead_engine_score != null) {
    scoreItems.push(`Lead Engine score ${row.lead_engine_score} available.`)
    if (row.lead_engine_score_explanation) {
      scoreItems.push(row.lead_engine_score_explanation)
    }
  } else if (row.lead_score != null && row.lead_score >= 40) {
    scoreItems.push(`Lead score ${row.lead_score} from internal records.`)
  }

  if (row.buying_stage) {
    const stageLabel = row.buying_stage.replace(/_/g, " ")
    scoreItems.push(`Buying stage assessed: ${stageLabel}.`)
    if (row.buying_stage_reason) scoreItems.push(row.buying_stage_reason)
  }

  if (row.intent_score != null && row.intent_score >= 10) {
    scoreItems.push(`Intent signal present (score ${row.intent_score}).`)
  } else if (row.search_intent_category) {
    scoreItems.push(`Search intent category: ${row.search_intent_category.replace(/_/g, " ")}.`)
  }

  if (row.company_match_confidence != null && row.company_match_confidence >= 0.5) {
    scoreItems.push(
      `Company match confidence ${Math.round(row.company_match_confidence * 100)}%.`,
    )
  }

  for (const reason of row.match_reasoning.slice(0, 2)) {
    if (!scoreItems.some((item) => item === reason)) scoreItems.push(reason)
  }

  const effectiveConfidence = row.signal_confidence ?? row.confidence
  if (effectiveConfidence >= 0.75) {
    confidenceItems.push("High confidence from multiple corroborating signals.")
  } else if (effectiveConfidence >= 0.55) {
    confidenceItems.push("Moderate confidence — some observable signals support the match.")
  } else {
    confidenceItems.push("Lower confidence because limited public or internal data is available.")
  }

  if (!row.website && !row.industry && row.signals.length === 0) {
    confidenceItems.push("Sparse company profile — review before outreach.")
  }

  if (row.existing_customer) confidenceItems.push("Existing CRM customer — treat as account expansion.")
  if (row.existing_prospect) confidenceItems.push("Existing CRM prospect — avoid duplicate prospecting.")
  if (row.in_lead_inbox) confidenceItems.push("Already in Lead Inbox — review queue before re-pushing.")
  if (row.is_suppressed) {
    confidenceItems.push(
      row.suppression_reason
        ? `Suppressed from outreach (${row.suppression_reason.replace(/_/g, " ")}).`
        : "Suppressed from outreach — do not contact.",
    )
  }

  if (normalizeDomain(row.website) && !row.crm_detected && !summary?.technology_signals.length) {
    confidenceItems.push("Website present but limited stack or signal enrichment.")
  }

  let recommended: string | null = null
  if (row.is_suppressed) {
    recommended = "Do not push — company or contact is suppressed from outreach."
  } else if (row.in_lead_inbox) {
    recommended = "Open Lead Inbox workspace to review before additional action."
  } else if (row.existing_customer) {
    recommended = "Treat as existing account — coordinate with customer success, not cold outreach."
  } else if (row.buying_stage?.includes("purchase")) {
    recommended = "High priority — review in Lead Inbox or run Lead Engine enrichment."
  } else if (row.lead_engine_score != null && row.lead_engine_score >= 60) {
    recommended = "Run Lead Engine or push to Lead Inbox for operator review."
  } else if (row.intent_score != null && row.intent_score >= 12) {
    recommended = "Intent signal present — push to Lead Inbox for human review."
  } else if (row.rank_score >= 0.5) {
    recommended = "Strong search match — add to list or push to Lead Inbox when qualified."
  } else {
    recommended = "Review enrichment signals before pushing to Lead Inbox."
  }

  return {
    score_explanation_items: uniqueItems(scoreItems),
    confidence_explanation_items: uniqueItems(confidenceItems),
    recommended_next_step_reason: recommended,
  }
}

export function hasProspectSearchExplanations(bundle: ProspectSearchExplanationBundle): boolean {
  return (
    bundle.score_explanation_items.length > 0 ||
    bundle.confidence_explanation_items.length > 0 ||
    Boolean(bundle.recommended_next_step_reason)
  )
}
