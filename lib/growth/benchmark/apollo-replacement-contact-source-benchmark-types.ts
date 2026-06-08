/** Phase 7.PS-IU — Verified contact source benchmark types. Client-safe. */

export const GROWTH_APOLLO_REPLACEMENT_CONTACT_SOURCE_BENCHMARK_QA_MARKER =
  "growth-apollo-replacement-contact-source-benchmark-7-ps-iu-v1" as const

export const GROWTH_APOLLO_REPLACEMENT_CONTACT_SOURCE_BENCHMARK_CERTIFICATION_QA_MARKER =
  "growth-apollo-replacement-contact-source-benchmark-certification-7-ps-iu-v1" as const

export const CONTACT_SOURCE_BENCHMARK_ID = "apollo-replacement-contact-source-benchmark" as const

export const CONTACT_SOURCE_BENCHMARK_TARGETS = {
  named_persons: 50,
  outreach_ready_companies: 15,
} as const

/** Post-PS-IR frozen cohort baseline (equipify-apollo-replacement-benchmark-v1). */
export const CONTACT_SOURCE_BENCHMARK_POST_PS_IR_BASELINE = {
  benchmark_id: "equipify-apollo-replacement-benchmark-v1",
  phase_version: "7.ps-ir",
  companies: 54,
  named_persons: 22,
  titled_persons: 18,
  verified_emails: 4,
  verified_phones: 2,
  outreach_ready_companies: 4,
} as const

export type ContactSourceEvidenceTier = "observed" | "estimate" | "exhausted"

export type ContactSourceDensityMetrics = {
  named_persons_per_100: number
  titled_persons_per_100: number
  verified_emails_per_100: number
  verified_phones_per_100: number
  outreach_ready_companies_per_100: number
}

export type ContactSourceCostMetrics = {
  cost_per_discovered_person_usd: number | null
  cost_per_verified_email_usd: number | null
  cost_per_outreach_ready_company_usd: number | null
}

export type ContactSourceOperationalMetrics = {
  api_available: boolean
  integration_complexity: 1 | 2 | 3 | 4 | 5
  maintenance_burden: 1 | 2 | 3 | 4 | 5
  provider_dependency_risk: 1 | 2 | 3 | 4 | 5
  rate_limit_risk: 1 | 2 | 3 | 4 | 5
  verification_compatible: boolean
  wired_in_codebase: boolean
  configured_at_runtime: boolean
}

export type ContactSourceBenchmarkEntry = {
  key: string
  label: string
  evidence_tier: ContactSourceEvidenceTier
  observed_phase: string | null
  density: ContactSourceDensityMetrics
  /** Marginal incremental lift on post-PS-IR baseline (not isolated total). */
  marginal_density: ContactSourceDensityMetrics
  cost: ContactSourceCostMetrics
  operational: ContactSourceOperationalMetrics
  confidence: 1 | 2 | 3 | 4 | 5
  notes: string
  rank_score: number
}

export type ContactSourceComparisonRow = {
  source: string
  named_person_lift: number
  verified_email_lift: number
  outreach_ready_lift: number
  cost_per_verified_email_usd: number | null
  complexity: number
  confidence: number
}

export type ContactSourceGapAnalysis = {
  current_named_persons: number
  current_verified_emails: number
  current_outreach_ready_companies: number
  target_named_persons: number
  target_outreach_ready_companies: number
  named_person_gap: number
  verified_email_gap: number
  outreach_ready_gap: number
  named_person_gap_per_100: number
  verified_email_gap_per_100: number
  outreach_ready_gap_per_100: number
}

export type ContactSourceStrategyRecommendation =
  | "pdl_only"
  | "pdl_plus_apollo"
  | "pdl_plus_seamless"
  | "pdl_plus_prospeo"
  | "apollo_only"
  | "seamless_only"
  | "hybrid_strategy"

export type ContactSourceBenchmarkResult = {
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_CONTACT_SOURCE_BENCHMARK_QA_MARKER
  benchmark_id: typeof CONTACT_SOURCE_BENCHMARK_ID
  baseline: typeof CONTACT_SOURCE_BENCHMARK_POST_PS_IR_BASELINE
  targets: typeof CONTACT_SOURCE_BENCHMARK_TARGETS
  gap_analysis: ContactSourceGapAnalysis
  sources: ContactSourceBenchmarkEntry[]
  comparison_matrix: ContactSourceComparisonRow[]
  source_ranking: Array<{
    rank: number
    key: string
    label: string
    rank_score: number
    evidence_tier: ContactSourceEvidenceTier
  }>
  combination_scenarios: Array<{
    strategy_key: string
    label: string
    projected_named_persons: number
    projected_verified_emails: number
    projected_outreach_ready_companies: number
    meets_named_target: boolean
    meets_outreach_target: boolean
    estimated_cost_usd: number | null
    estimated_weeks_to_pilot: number
  }>
  recommendation: ContactSourceStrategyRecommendation
  recommendation_rationale: string
  estimated_weeks_to_targets: number | null
  messages: string[]
}
