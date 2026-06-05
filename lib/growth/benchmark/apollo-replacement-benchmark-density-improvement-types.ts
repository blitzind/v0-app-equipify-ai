/** Phase 7.PS-IK — Benchmark-gated density improvement types. Client-safe. */

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_IMPROVEMENT_QA_MARKER =
  "growth-apollo-replacement-benchmark-density-improvement-7-ps-ik-v1" as const

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_IMPROVEMENT_CERTIFICATION_QA_MARKER =
  "growth-apollo-replacement-benchmark-density-improvement-certification-7-ps-ik-v1" as const

export const APOLLO_BENCHMARK_DENSITY_DEFAULT_MAX_TARGETS = 8 as const

export type ApolloBenchmarkCohortSegment =
  | "no_contacts"
  | "generic_channels_only"
  | "named_without_verified_channel"
  | "titled_without_committee"
  | "verified_channel_not_outreach_ready"
  | "outreach_ready"

export type ApolloBenchmarkDensityTargetRow = {
  canonical_company_id: string
  company_candidate_id: string
  company_name: string
  segment: ApolloBenchmarkCohortSegment
  service_shop_score: number
  is_ps_he_anchor: boolean
  has_website: boolean
  contact_count: number
}

export type ApolloBenchmarkCohortSegmentation = {
  no_contacts: number
  generic_channels_only: number
  named_without_verified_channel: number
  titled_without_committee: number
  verified_channel_not_outreach_ready: number
  outreach_ready: number
}

export type ApolloBenchmarkDensityImprovementMetrics = {
  targets_selected: number
  targets_processed: number
  targets_succeeded: number
  named_persons_added: number
  verified_emails_added: number
  outreach_ready_companies_added: number
  external_evidence_sources: number
  website_fetches: number
}
