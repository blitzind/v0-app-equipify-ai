/** Phase 7.PS-IQ — Person acquisition source benchmark audit types. Client-safe. */

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PERSON_ACQUISITION_SOURCE_QA_MARKER =
  "growth-apollo-replacement-benchmark-person-acquisition-source-7-ps-iq-v1" as const

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PERSON_ACQUISITION_SOURCE_CERTIFICATION_QA_MARKER =
  "growth-apollo-replacement-benchmark-person-acquisition-source-certification-7-ps-iq-v1" as const

export const PERSON_ACQUISITION_SOURCE_CATEGORIES = [
  "existing_configured",
  "paid_enrichment_api",
  "free_public_structured",
  "hybrid_manual",
] as const

export type PersonAcquisitionSourceCategory =
  (typeof PERSON_ACQUISITION_SOURCE_CATEGORIES)[number]

export type PersonAcquisitionSourceRecommendation =
  | "implement_next"
  | "pilot_benchmark"
  | "defer"
  | "exhausted"
  | "not_wired"

export type PersonAcquisitionSourceYieldEstimate = {
  /** Named persons discovered per 100 benchmark companies. */
  named_persons_per_100: number
  /** Titled persons discovered per 100 benchmark companies. */
  titled_persons_per_100: number
  /** Verified emails after existing ZeroBounce gates, per 100 companies. */
  verified_emails_per_100: number
  /** Verified phones after existing gates, per 100 companies. */
  verified_phones_per_100: number
  /** Outreach-ready companies after existing gates, per 100 companies. */
  outreach_ready_companies_per_100: number
}

export type PersonAcquisitionSourceRegistryEntry = {
  key: string
  label: string
  category: PersonAcquisitionSourceCategory
  description: string
  /** Whether the provider hook exists in the growth stack today. */
  wired_in_codebase: boolean
  /** Whether runtime env keys are present (audit-time only). */
  configured_at_runtime: boolean
  /** Observed on the Apollo benchmark cohort in PS-IM through PS-IP. */
  benchmark_observed: boolean
  /** Phase that produced the observed yield, if any. */
  observed_phase: string | null
  yield: PersonAcquisitionSourceYieldEstimate
  /** USD per verified email/phone contact (rough order-of-magnitude). */
  cost_per_verified_contact_usd: number | null
  /** 1 (low) – 5 (high) implementation complexity. */
  implementation_complexity: 1 | 2 | 3 | 4 | 5
  /** 1 (low) – 5 (high) compliance / terms-of-service risk. */
  compliance_risk: 1 | 2 | 3 | 4 | 5
  recommendation: PersonAcquisitionSourceRecommendation
  recommendation_rationale: string
  /** Rank score used for ordering (higher = better expected ROI). */
  rank_score: number
}

export const PERSON_ACQUISITION_BENCHMARK_TARGETS = {
  named_persons_per_100: 50,
  outreach_ready_companies_per_100: 15,
} as const

export type PersonAcquisitionSourceAuditMetrics = {
  sources_evaluated: number
  sources_wired: number
  sources_configured: number
  sources_observed_on_benchmark: number
  sources_meeting_named_target: number
  sources_meeting_outreach_target: number
  sources_meeting_both_targets: number
}
