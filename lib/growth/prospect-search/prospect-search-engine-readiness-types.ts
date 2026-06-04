/** Prospect Search — Growth Engine readiness & prioritization (Phase 7.PS-D). Client-safe. */

export const GROWTH_PROSPECT_SEARCH_ENGINE_READINESS_QA_MARKER =
  "growth-prospect-search-readiness-7-ps-d-v1" as const

export const GROWTH_PROSPECT_SEARCH_PRIORITIZATION_TIERS = [
  "ready_for_outreach",
  "outreach_with_gaps",
  "research_first",
  "insufficient_data",
] as const

export type GrowthProspectSearchPrioritizationTier =
  (typeof GROWTH_PROSPECT_SEARCH_PRIORITIZATION_TIERS)[number]

export const GROWTH_PROSPECT_SEARCH_RESEARCH_COMPLETENESS = [
  "fully_researched",
  "partially_researched",
  "research_recommended",
  "research_blocked",
  "insufficient_data",
] as const

export type GrowthProspectSearchResearchCompleteness =
  (typeof GROWTH_PROSPECT_SEARCH_RESEARCH_COMPLETENESS)[number]

export type GrowthProspectSearchReadinessLevel = "ready" | "partial" | "gap" | "blocked"

export type GrowthProspectSearchReadinessDimensionScore = {
  score: number
  level: GrowthProspectSearchReadinessLevel
  summary: string
  reasons: string[]
  evidence: string[]
}

export type GrowthProspectSearchEngineReadiness = {
  qa_marker: typeof GROWTH_PROSPECT_SEARCH_ENGINE_READINESS_QA_MARKER
  has_canonical_company: boolean
  schema_ready: boolean
  contactability: GrowthProspectSearchReadinessDimensionScore
  channel: GrowthProspectSearchReadinessDimensionScore
  committee: GrowthProspectSearchReadinessDimensionScore
  company_intelligence: GrowthProspectSearchReadinessDimensionScore
  overall: GrowthProspectSearchReadinessDimensionScore
  research_completeness: GrowthProspectSearchResearchCompleteness
  prioritization_tier: GrowthProspectSearchPrioritizationTier
  prioritization_rank: number
  operator_summary: string
  missing_critical_committee_roles: string[]
  missing_intelligence_categories: string[]
  reachable_decision_maker_count: number
}
