/** Phase 7.PS-IE — Batch wave density improvement types. Client-safe. */

export const GROWTH_BATCH_WAVE_DENSITY_IMPROVEMENT_QA_MARKER =
  "growth-batch-wave-density-improvement-7-ps-ie-v1" as const

export const GROWTH_BATCH_WAVE_DENSITY_IMPROVEMENT_CERTIFICATION_QA_MARKER =
  "growth-batch-wave-density-improvement-certification-7-ps-ie-v1" as const

export const BATCH_WAVE_DENSITY_IMPROVEMENT_QUEUE_REASON = "batch_wave_density_improvement" as const

export type BatchWaveDensityImprovementCohortCompany = {
  company_candidate_id: string
  canonical_company_id: string
  company_name: string
  search_query: string
  contact_count: number
  batch_id: string
  cohort_kind: "wave_enriched" | "ps_he_anchor"
}

export type BatchWaveDensityCompanyAudit = {
  company_name: string
  canonical_company_id: string
  website_url: string | null
  pages_crawled_before: string[]
  pages_skipped_before: string[]
  pages_failed_before: string[]
  person_page_paths_attempted: string[]
  person_page_paths_missing: string[]
  contact_evidence: Array<{
    full_name: string
    title: string | null
    email: string | null
    phone: string | null
    source_type: string | null
    source_page_url: string | null
    generic_reason: string | null
  }>
  named_persons_before: number
  titled_persons_before: number
  verified_emails_before: number
  verified_phones_before: number
  generic_contacts_before: number
  external_evidence_signals: number
  why_remained_generic: string[]
  discovery_gaps: string[]
}

export type BatchWaveDensityImprovementMetrics = {
  companies_processed: number
  companies_succeeded: number
  companies_failed: number
  pages_newly_crawled: number
  named_persons_delta: number
  titles_delta: number
  verified_emails_delta: number
  verified_phones_delta: number
  generic_contacts_preserved: number
  outreach_ready_delta: number
  runtime_ms: number
  fetch_errors: number
}

export type BatchWaveDensityImprovementResult = {
  qa_marker: typeof GROWTH_BATCH_WAVE_DENSITY_IMPROVEMENT_QA_MARKER
  ok: boolean
  batch_id: string
  companies_inspected: number
  company_audits: BatchWaveDensityCompanyAudit[]
  metrics: BatchWaveDensityImprovementMetrics
  names_recovered: string[]
  titles_recovered: string[]
  verified_channels_promoted: number
  density_funnel: {
    before: import("@/lib/growth/graph-expansion/batch-graph-expansion-types").BatchGraphExpansionDensityFunnel
    after: import("@/lib/growth/graph-expansion/batch-graph-expansion-types").BatchGraphExpansionDensityFunnel
  }
  company_results: Array<{
    company_name: string
    canonical_company_id: string
    ok: boolean
    pages_newly_crawled: string[]
    named_persons_delta: number
    messages: string[]
  }>
  messages: string[]
}
