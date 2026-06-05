/** Phase 7.PS-IN — Benchmark identity quality cleanup types. Client-safe. */

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_QA_MARKER =
  "growth-apollo-replacement-benchmark-identity-quality-7-ps-in-v1" as const

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_CERTIFICATION_QA_MARKER =
  "growth-apollo-replacement-benchmark-identity-quality-certification-7-ps-in-v1" as const

export type BenchmarkSuspiciousIdentityRow = {
  company_contact_id: string
  company_id: string
  company_name: string
  person_id: string | null
  full_name: string
  email: string | null
  upgrade_method: string | null
  evidence_ref: string | null
  source_page_url: string | null
  is_real_person_name: boolean
  should_contain: boolean
  containment_reason: string | null
}

export type BenchmarkIdentityContainmentResult = {
  company_contact_id: string
  person_id: string | null
  full_name: string
  email: string | null
  contained: boolean
  channels_preserved: number
  contact_reverted_to_generic: boolean
  person_contained: boolean
  reason: string
  messages: string[]
}

export type BenchmarkIdentityQualityMetrics = {
  suspicious_inspected: number
  false_positives_contained: number
  false_positives_addressed: number
  evidence_channels_preserved: number
  persons_contained: number
  contacts_unlinked: number
  legitimate_preserved: number
  incorrect_containments_restored: number
}
