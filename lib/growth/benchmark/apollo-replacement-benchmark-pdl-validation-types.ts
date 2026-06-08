/** Phase 7.PS-IR — Benchmark PDL validation types. Client-safe. */

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_QA_MARKER =
  "growth-apollo-replacement-benchmark-pdl-validation-7-ps-ir-v1" as const

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_CERTIFICATION_QA_MARKER =
  "growth-apollo-replacement-benchmark-pdl-validation-certification-7-ps-ir-v1" as const

export type BenchmarkPdlValidationRejectedRecord = {
  company_name: string
  full_name: string
  email: string | null
  reason: string
}

export type BenchmarkPdlValidationCompanyResult = {
  canonical_company_id: string
  company_name: string
  company_candidate_id: string
  status: "success" | "skipped" | "failed" | "no_results"
  persons_discovered: number
  persons_accepted: number
  persons_persisted: number
  persons_rejected: number
  named_persons_before: number
  named_persons_after: number
  titled_persons_before: number
  titled_persons_after: number
  messages: string[]
}

export type BenchmarkPdlValidationMetrics = {
  companies_processed: number
  companies_with_results: number
  companies_enriched: number
  persons_discovered: number
  persons_accepted: number
  persons_persisted: number
  persons_rejected: number
  persons_promoted: number
  titles_added: number
  committee_members_created: number
  verified_emails_added: number
  outreach_ready_companies_added: number
}
