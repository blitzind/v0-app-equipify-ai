/** Phase 7.PS-IF — ICP-filtered batch expansion types. Client-safe. */

export const GROWTH_BATCH_ICP_FILTERED_EXPANSION_QA_MARKER =
  "growth-batch-icp-filtered-expansion-7-ps-if-v1" as const

export const GROWTH_BATCH_ICP_FILTERED_EXPANSION_CERTIFICATION_QA_MARKER =
  "growth-batch-icp-filtered-expansion-certification-7-ps-if-v1" as const

export const BATCH_ICP_PRIOR_WAVE_NAMED_PERSONS = 0 as const

export type BatchIcpFitDecision = "qualified" | "excluded"

export type BatchIcpCohortDiagnosticRow = {
  company_name: string
  canonical_company_id: string
  company_candidate_id: string
  industry: string | null
  source_tags: string[]
  website: string | null
  domain: string | null
  decision: BatchIcpFitDecision
  icp_match_reason: string | null
  exclusion_reason: string | null
  contact_count: number
}

export type BatchIcpFilteredCohortDiagnostics = {
  icp_qualified_count: number
  off_icp_excluded_count: number
  selected: BatchIcpCohortDiagnosticRow[]
  excluded_sample: BatchIcpCohortDiagnosticRow[]
}

export type BatchIcpFilteredExpansionResult = {
  qa_marker: typeof GROWTH_BATCH_ICP_FILTERED_EXPANSION_QA_MARKER
  ok: boolean
  cohort_diagnostics: BatchIcpFilteredCohortDiagnostics
  expansion: import("@/lib/growth/graph-expansion/batch-graph-expansion-types").BatchGraphExpansionResult
  prior_wave_named_persons: number
  named_person_yield_delta: number
  messages: string[]
}
