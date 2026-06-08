/** Phase 7.PS-IP — Benchmark officer/principal discovery types. Client-safe. */

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_OFFICER_PRINCIPAL_QA_MARKER =
  "growth-apollo-replacement-benchmark-officer-principal-7-ps-ip-v1" as const

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_OFFICER_PRINCIPAL_CERTIFICATION_QA_MARKER =
  "growth-apollo-replacement-benchmark-officer-principal-certification-7-ps-ip-v1" as const

export const BENCHMARK_OFFICER_PRINCIPAL_SOURCE_TYPES = [
  "secretary_of_state_filing",
  "corporate_officer_filing",
  "llc_member_manager_record",
  "state_business_registry",
  "bbb_ownership_principal",
  "manufacturer_authorized_service_provider",
  "licensing_database",
  "public_company_officer_record",
  "public_ownership_disclosure",
] as const

export type BenchmarkOfficerPrincipalSourceType =
  (typeof BENCHMARK_OFFICER_PRINCIPAL_SOURCE_TYPES)[number]

export type BenchmarkOfficerPrincipalSourceEntry = {
  key: string
  company_id: string
  company_name: string
  source_type: BenchmarkOfficerPrincipalSourceType
  label: string
  urls: string[]
  free_public_only: true
  reproducible: true
}

export type BenchmarkOfficerPrincipalRecordKind = "officer" | "principal"

export type BenchmarkOfficerPrincipalEvidenceRecord = {
  company_id: string
  company_name: string
  person_name: string
  title: string | null
  record_kind: BenchmarkOfficerPrincipalRecordKind
  source_type: BenchmarkOfficerPrincipalSourceType
  source_url: string
  evidence_excerpt: string
  discovered_at: string
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_OFFICER_PRINCIPAL_QA_MARKER
}

export type BenchmarkOfficerPrincipalRejectedRecord = {
  company_id: string
  company_name: string
  person_name: string | null
  source_url: string
  reason: string
}

export type BenchmarkOfficerPrincipalDiscoveryMetrics = {
  companies_queried: number
  evidence_sources_queried: number
  sources_with_records: number
  officer_records_found: number
  principal_records_found: number
  evidence_records_collected: number
  evidence_records_accepted: number
  evidence_records_rejected: number
  persons_created: number
  titles_created: number
  committee_members_created: number
  companies_enriched: number
}
