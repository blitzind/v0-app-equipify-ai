/** Phase 7.PS-IL — Benchmark verified email completion types. Client-safe. */

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_QA_MARKER =
  "growth-apollo-replacement-benchmark-verified-email-7-ps-il-v1" as const

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_CERTIFICATION_QA_MARKER =
  "growth-apollo-replacement-benchmark-verified-email-certification-7-ps-il-v1" as const

export type BenchmarkVerifiedEmailCandidateRow = {
  company_contact_id: string
  company_id: string
  company_name: string
  person_id: string
  full_name: string
  email: string
  source_type: string
  ps_ik_upgrade: boolean
  upgrade_method: string | null
  evidence_ref: string | null
  source_page_url: string | null
}

export type BenchmarkVerifiedEmailRejectedRow = {
  company_contact_id: string
  company_id: string
  full_name: string
  email: string | null
  rejection_reason: string
}

export type BenchmarkVerifiedEmailCompletionProvenance = {
  provider: string
  deployed_runtime_used: boolean
  execution_channel: string
  source_evidence: string
  contact_id: string
  email: string
}

export type BenchmarkVerifiedEmailCompletionMetrics = {
  candidates_selected: number
  candidates_rejected: number
  emails_attempted: number
  emails_verified: number
  emails_promoted: number
  persons_with_new_verified_email: number
}
