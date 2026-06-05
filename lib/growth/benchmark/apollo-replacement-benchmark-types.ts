/** Phase 7.PS-IJ — Apollo replacement benchmark types. Client-safe. */

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_QA_MARKER =
  "growth-apollo-replacement-benchmark-7-ps-ij-v1" as const

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_CERTIFICATION_QA_MARKER =
  "growth-apollo-replacement-benchmark-certification-7-ps-ij-v1" as const

export const APOLLO_REPLACEMENT_BENCHMARK_ID = "equipify-apollo-replacement-benchmark-v1" as const
export const APOLLO_REPLACEMENT_BENCHMARK_COHORT_VERSION = "7.ps-ij.v1" as const
export const APOLLO_REPLACEMENT_BENCHMARK_TARGET_SIZE = 100 as const
export const APOLLO_REPLACEMENT_BENCHMARK_BASELINE_PHASE_VERSION = "baseline" as const

export const APOLLO_REPLACEMENT_BENCHMARK_COHORT_QUEUE_REASON =
  "apollo_replacement_benchmark_cohort" as const
export const APOLLO_REPLACEMENT_BENCHMARK_SNAPSHOT_QUEUE_REASON =
  "apollo_replacement_benchmark_snapshot" as const

export type ApolloReplacementBenchmarkCohortComposition = {
  icp_qualified: number
  service_shop_high: number
  service_shop_medium: number
  ps_he_anchors: number
  off_icp_excluded: number
  down_ranked_excluded: number
  inclusion_reasons: Record<string, number>
  exclusion_reasons: Record<string, number>
}

export type ApolloReplacementBenchmarkCohortRecord = {
  benchmark_id: string
  cohort_version: string
  company_ids: string[]
  company_count: number
  composition: ApolloReplacementBenchmarkCohortComposition
  created_at: string
}

export type ApolloReplacementBenchmarkCompanyMetrics = {
  total_companies: number
  companies_with_contacts: number
  companies_with_named_persons: number
  companies_with_titled_persons: number
  outreach_ready_companies: number
  sequence_ready_companies: number
}

export type ApolloReplacementBenchmarkPersonMetrics = {
  total_persons: number
  named_persons: number
  titled_persons: number
  committee_members: number
}

export type ApolloReplacementBenchmarkChannelMetrics = {
  verified_emails: number
  verified_phones: number
  verified_social_profiles: number
}

export type ApolloReplacementBenchmarkQualityMetrics = {
  named_person_density: number
  title_density: number
  committee_density: number
  outreach_ready_density: number
  sequence_ready_density: number
}

export type ApolloReplacementBenchmarkMetrics = {
  company: ApolloReplacementBenchmarkCompanyMetrics
  person: ApolloReplacementBenchmarkPersonMetrics
  channel: ApolloReplacementBenchmarkChannelMetrics
  quality: ApolloReplacementBenchmarkQualityMetrics
}

export type ApolloReplacementBenchmarkSnapshotRecord = {
  snapshot_id: string
  benchmark_id: string
  phase_name: string
  phase_version: string
  snapshot_kind: "baseline" | "phase_run" | "comparison"
  captured_at: string
  metrics: ApolloReplacementBenchmarkMetrics
}

export type ApolloReplacementBenchmarkMetricDelta = {
  before: number
  after: number
  absolute: number
  percent: number | null
}

export type ApolloReplacementBenchmarkDeltaReport = {
  benchmark_id: string
  before_snapshot: ApolloReplacementBenchmarkSnapshotRecord
  after_snapshot: ApolloReplacementBenchmarkSnapshotRecord
  deltas: {
    named_persons: ApolloReplacementBenchmarkMetricDelta
    titled_persons: ApolloReplacementBenchmarkMetricDelta
    verified_emails: ApolloReplacementBenchmarkMetricDelta
    verified_phones: ApolloReplacementBenchmarkMetricDelta
    committee_members: ApolloReplacementBenchmarkMetricDelta
    outreach_ready_companies: ApolloReplacementBenchmarkMetricDelta
    sequence_ready_companies: ApolloReplacementBenchmarkMetricDelta
  }
}

export type ApolloReplacementBenchmarkRunResult = {
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_QA_MARKER
  ok: boolean
  cohort: ApolloReplacementBenchmarkCohortRecord
  baseline_snapshot: ApolloReplacementBenchmarkSnapshotRecord | null
  current_snapshot: ApolloReplacementBenchmarkSnapshotRecord
  delta_report: ApolloReplacementBenchmarkDeltaReport | null
  runtime_ms: number
  messages: string[]
}
