/** Phase 7.PS-IM — Benchmark density scale-up types. Client-safe. */

import type { BenchmarkVerifiedEmailCandidateRow } from "@/lib/growth/benchmark/apollo-replacement-benchmark-verified-email-types"

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_SCALE_UP_QA_MARKER =
  "growth-apollo-replacement-benchmark-density-scale-up-7-ps-im-v1" as const

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_SCALE_UP_CERTIFICATION_QA_MARKER =
  "growth-apollo-replacement-benchmark-density-scale-up-certification-7-ps-im-v1" as const

export const APOLLO_DENSITY_SCALE_UP_DEFAULT_ICP_OUTSIDE_LIMIT = 50 as const
export const APOLLO_DENSITY_SCALE_UP_DEFAULT_UPGRADE_LIMIT = 200 as const
export const APOLLO_DENSITY_SCALE_UP_DEFAULT_VERIFY_LIMIT = 40 as const
export const APOLLO_DENSITY_SCALE_UP_DEFAULT_ICP_SCAN_LIMIT = 400 as const
export const APOLLO_DENSITY_SCALE_UP_DEFAULT_WEBSITE_REFRESH_LIMIT = 12 as const

export type DensityScaleUpCohortScope = {
  benchmark_company_ids: string[]
  icp_outside_company_ids: string[]
  all_company_ids: string[]
  benchmark_company_count: number
  icp_outside_company_count: number
}

export type DensityScaleUpUpgradeCandidateRow = {
  company_contact_id: string
  company_id: string
  company_name: string
  full_name: string
  email: string
  source_type: string
  evidence_ref: string | null
  source_page_url: string | null
  in_benchmark: boolean
}

export type DensityScaleUpRejectedRow = {
  company_contact_id: string
  company_id: string
  full_name: string
  email: string | null
  rejection_reason: string
}

export type DensityScaleUpMetrics = {
  candidates_found: number
  candidates_rejected: number
  identities_upgraded: number
  identities_skipped: number
  emails_selected: number
  emails_rejected: number
  emails_attempted: number
  emails_verified: number
  emails_promoted: number
  persons_with_new_verified_email: number
  benchmark_company_count: number
  icp_outside_company_count: number
}

export type DensityScaleUpQueuePersonResult = {
  full_name: string
  email: string
  company_name: string
  person_id: string
  company_id: string
  verified: boolean
  promoted: boolean
  execution_channel: string
  messages: string[]
}

export type DensityScaleUpQueueRecord = {
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_SCALE_UP_QA_MARKER
  benchmark_id: string
  status: "scheduled" | "processing" | "completed" | "failed"
  requested_at: string
  completed_at: string | null
  candidates: BenchmarkVerifiedEmailCandidateRow[]
  person_results: DensityScaleUpQueuePersonResult[]
  error: string | null
}
