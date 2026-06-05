/** Phase 7.PS-IB — Batch graph expansion orchestration types. Client-safe. */

export const GROWTH_BATCH_GRAPH_EXPANSION_QA_MARKER =
  "growth-batch-graph-expansion-7-ps-ib-v1" as const

export const GROWTH_BATCH_GRAPH_EXPANSION_CERTIFICATION_QA_MARKER =
  "growth-batch-graph-expansion-certification-7-ps-ib-v1" as const

export const BATCH_GRAPH_EXPANSION_QUEUE_REASON = "batch_graph_expansion" as const
export const BATCH_GRAPH_EXPANSION_MANIFEST_REASON = "batch_graph_expansion_manifest" as const

export const DEFAULT_BATCH_GRAPH_EXPANSION_WAVE_SIZE = 25
export const DEFAULT_BATCH_GRAPH_EXPANSION_MAX_WAVE_SIZE = 30
export const DEFAULT_BATCH_GRAPH_EXPANSION_MIN_WAVE_SIZE = 20
export const DEFAULT_BATCH_GRAPH_EXPANSION_COMPANY_TIMEOUT_MS = 120_000
export const DEFAULT_BATCH_GRAPH_EXPANSION_MAX_FETCH_ERRORS_PER_WAVE = 12
export const DEFAULT_BATCH_GRAPH_EXPANSION_MAX_PROVIDER_CALLS_PER_WAVE = 40
export const DEFAULT_BATCH_GRAPH_EXPANSION_STALE_ENRICHMENT_DAYS = 14

export type BatchGraphExpansionCompanyStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "stopped"

export type BatchGraphExpansionManifestStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"

export type BatchGraphExpansionCohortCompany = {
  company_candidate_id: string
  canonical_company_id: string
  company_name: string
  search_query: string
  contact_count: number
  enrichment_stale: boolean
  cohort_kind: "unenriched" | "stale" | "ps_he_anchor"
}

export type BatchGraphExpansionProviderCounters = {
  website_fetches: number
  zerobounce_calls: number
  external_evidence_sources: number
  channel_completion_persons: number
}

export type BatchGraphExpansionManifest = {
  batch_id: string
  resume_token: string
  status: BatchGraphExpansionManifestStatus
  wave_size: number
  wave_index: number
  companies_total: number
  companies_queued: number
  companies_completed: number
  companies_failed: number
  companies_skipped: number
  last_company_id: string | null
  failure_reasons: string[]
  provider_counters: BatchGraphExpansionProviderCounters
  started_at: string
  updated_at: string
  stopped: boolean
}

export type BatchGraphExpansionCompanyMetrics = {
  contacts_discovered: number
  named_persons_added: number
  titles_added: number
  verified_emails_added: number
  verified_phones_added: number
  generic_shells_contained: number
  corroborated_persons: number
  runtime_ms: number
  fetch_errors: number
  failure_reason: string | null
}

export type BatchGraphExpansionWaveMetrics = {
  companies_processed: number
  companies_succeeded: number
  companies_failed: number
  contacts_discovered: number
  named_persons_added: number
  titles_added: number
  verified_emails_added: number
  verified_phones_added: number
  generic_shells_contained: number
  outreach_ready_delta: number
  runtime_ms: number
  fetch_errors: number
  provider_counters: BatchGraphExpansionProviderCounters
}

export type BatchGraphExpansionDensityFunnel = {
  companies: number
  companies_with_contacts: number
  named_person_companies: number
  verified_channel_companies: number
  outreach_ready_companies: number
  total_named_persons: number
  total_verified_emails: number
  total_verified_phones: number
  generic_identities: number
}

export type BatchGraphExpansionResult = {
  qa_marker: typeof GROWTH_BATCH_GRAPH_EXPANSION_QA_MARKER
  ok: boolean
  batch_id: string
  resume_token: string
  manifest: BatchGraphExpansionManifest
  wave_metrics: BatchGraphExpansionWaveMetrics
  density_funnel: {
    before: BatchGraphExpansionDensityFunnel
    after: BatchGraphExpansionDensityFunnel
  }
  company_results: Array<{
    company_name: string
    canonical_company_id: string
    status: BatchGraphExpansionCompanyStatus
    metrics: BatchGraphExpansionCompanyMetrics
    messages: string[]
  }>
  messages: string[]
}
