/** Phase 7.PS-IG — Service-shop batch expansion types. Client-safe. */

export const GROWTH_SERVICE_SHOP_EXPANSION_QA_MARKER =
  "growth-service-shop-expansion-7-ps-ig-v1" as const

export const GROWTH_SERVICE_SHOP_EXPANSION_CERTIFICATION_QA_MARKER =
  "growth-service-shop-expansion-certification-7-ps-ig-v1" as const

export const SERVICE_SHOP_PRIOR_WAVE_NAMED_PERSONS = 0 as const

export type ServiceShopCohortDiagnosticRow = {
  company_name: string
  canonical_company_id: string
  company_candidate_id: string
  industry: string | null
  source_tags: string[]
  website: string | null
  domain: string | null
  city: string | null
  state: string | null
  service_shop_score: number
  score_tier: "high" | "medium" | "low"
  up_signals: string[]
  down_rank_reason: string | null
  contact_count: number
}

export type ServiceShopCohortDiagnostics = {
  companies_scored: number
  companies_selected: number
  down_ranked_excluded: number
  score_distribution: { high: number; medium: number; low: number }
  selected: ServiceShopCohortDiagnosticRow[]
  down_ranked_sample: ServiceShopCohortDiagnosticRow[]
}

export type ServiceShopSourceContribution = {
  source_type: string
  records_matched: number
  names_discovered: number
}

export type ServiceShopExpansionResult = {
  qa_marker: typeof GROWTH_SERVICE_SHOP_EXPANSION_QA_MARKER
  ok: boolean
  cohort_diagnostics: ServiceShopCohortDiagnostics
  expansion: import("@/lib/growth/graph-expansion/batch-graph-expansion-types").BatchGraphExpansionResult
  prior_wave_named_persons: number
  named_person_yield_delta: number
  names_discovered: string[]
  titles_discovered: string[]
  source_contribution: ServiceShopSourceContribution[]
  messages: string[]
}
