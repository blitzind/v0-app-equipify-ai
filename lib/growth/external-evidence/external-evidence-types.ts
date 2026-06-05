/** Phase 7.PS-HX — External evidence source expansion types. Client-safe. */

export const GROWTH_EXTERNAL_EVIDENCE_QA_MARKER = "growth-external-evidence-7-ps-hx-v1" as const

export const GROWTH_EXTERNAL_EVIDENCE_SOURCE_TYPES = [
  "association_directory",
  "conference_exhibitor_directory",
  "conference_speaker_page",
  "public_certification_directory",
  "public_business_directory",
  "manufacturer_partner_directory",
  "vendor_locator_directory",
] as const

export type ExternalEvidenceSourceType = (typeof GROWTH_EXTERNAL_EVIDENCE_SOURCE_TYPES)[number]

export type ExternalEvidenceRegistryEntry = {
  key: string
  source_type: ExternalEvidenceSourceType
  label: string
  urls: string[]
  industry_scope: string
  /** Public HTTP only — no paid enrichment APIs. */
  free_public_only: boolean
  live: boolean
}

export type ExternalEvidenceRecord = {
  company_name: string
  person_name: string | null
  title: string | null
  source_url: string
  source_type: ExternalEvidenceSourceType
  evidence_excerpt: string
  observed_at: string
  qa_marker: typeof GROWTH_EXTERNAL_EVIDENCE_QA_MARKER
}

export type ExternalEvidenceExpansionMetrics = {
  sources_queried: number
  sources_with_records: number
  external_evidence_records: number
  names_discovered: number
  titles_discovered: number
  companies_enriched: number
  persons_materialized: number
  committee_members_promoted: number
  latent_titles_recovered: number
}
