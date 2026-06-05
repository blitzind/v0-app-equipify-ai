/** Phase 7.PS-HW — Title & role evidence types. Client-safe. */

export const GROWTH_TITLE_ROLE_EVIDENCE_QA_MARKER =
  "growth-title-role-evidence-7-ps-hw-v1" as const

export const GROWTH_TITLE_ROLE_EVIDENCE_SOURCES = [
  "team_page",
  "leadership_page",
  "schema_org",
  "staff_directory",
  "author_byline",
  "contact_card",
  "structured_metadata",
  "about_page",
] as const

export type TitleRoleEvidenceSource = (typeof GROWTH_TITLE_ROLE_EVIDENCE_SOURCES)[number]

export type TitleRoleEvidenceRecord = {
  title: string
  source: TitleRoleEvidenceSource
  source_url: string | null
  evidence_excerpt: string
  claim: string
  observed_at: string
  qa_marker: typeof GROWTH_TITLE_ROLE_EVIDENCE_QA_MARKER
  person_id?: string | null
  company_id?: string | null
  company_contact_id?: string | null
}

export type TitleRoleEvidenceExpansionMetrics = {
  companies_processed: number
  persons_scanned: number
  titles_discovered: number
  persons_enriched: number
  roles_upserted: number
  committee_members_promoted: number
  critical_roles_detected: number
  website_contacts_with_titles: number
}
