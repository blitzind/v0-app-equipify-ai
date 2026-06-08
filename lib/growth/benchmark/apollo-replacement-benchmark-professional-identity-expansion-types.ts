/** Phase 7.PS-IO — Benchmark multi-source professional identity expansion types. Client-safe. */

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_QA_MARKER =
  "growth-apollo-replacement-benchmark-professional-identity-expansion-7-ps-io-v1" as const

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_CERTIFICATION_QA_MARKER =
  "growth-apollo-replacement-benchmark-professional-identity-expansion-certification-7-ps-io-v1" as const

export const BENCHMARK_PROFESSIONAL_IDENTITY_SOURCE_TYPES = [
  "manufacturer_partner_directory",
  "authorized_service_provider_directory",
  "oem_service_network",
  "association_directory",
  "htm_biomedical_association",
  "conference_speaker_page",
  "conference_exhibitor_staff",
  "public_certification_directory",
  "state_business_registration",
  "public_business_directory",
  "public_professional_profile_page",
  "vendor_locator_directory",
] as const

export type BenchmarkProfessionalIdentitySourceType =
  (typeof BENCHMARK_PROFESSIONAL_IDENTITY_SOURCE_TYPES)[number]

export type BenchmarkProfessionalIdentityRegistryEntry = {
  key: string
  source_type: BenchmarkProfessionalIdentitySourceType
  label: string
  urls: string[]
  industry_scope: string
  free_public_only: boolean
  live: boolean
  reproducible: boolean
}

export type BenchmarkProfessionalIdentityEvidenceRecord = {
  company_name: string
  person_name: string
  title: string | null
  source_url: string
  source_type: BenchmarkProfessionalIdentitySourceType
  evidence_excerpt: string
  observed_at: string
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_QA_MARKER
}

export type BenchmarkProfessionalIdentityCommitteeClassification = {
  job_title: string
  committee_role: string
  pattern_id: string
  matched_span: string
  confidence_tier: "direct_evidence"
  source_url: string
  source_type: BenchmarkProfessionalIdentitySourceType
  evidence_excerpt: string
}

export type BenchmarkProfessionalIdentityExpansionMetrics = {
  sources_queried: number
  sources_with_records: number
  evidence_records_collected: number
  evidence_records_accepted: number
  evidence_records_rejected: number
  persons_created: number
  titles_created: number
  committee_members_created: number
  companies_enriched: number
}

export type BenchmarkProfessionalIdentityRejectedRecord = {
  person_name: string | null
  company_name: string
  source_url: string
  reason: string
}
