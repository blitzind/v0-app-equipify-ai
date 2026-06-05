/** Phase 7.PS-HY — Professional identity corroboration types. Client-safe. */

export const GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER =
  "growth-professional-identity-corroboration-7-ps-hy-v1" as const

export const GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_SOURCE_TYPES = [
  "public_search_snippet",
  "company_website_reference",
  "association_page",
  "conference_page",
  "public_linkedin_url_reference",
] as const

export type ProfessionalIdentityCorroborationSourceType =
  (typeof GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_SOURCE_TYPES)[number]

export type ProfessionalIdentityCorroborationSignal = {
  source_url: string
  source_type: ProfessionalIdentityCorroborationSourceType
  matched_name: string
  matched_company: string
  matched_title: string | null
  confidence_contribution: number
  evidence_excerpt: string
  linkedin_url: string | null
  observed_at: string
  qa_marker: typeof GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER
}

export type EvidenceBackedPersonTarget = {
  person_id: string
  company_id: string
  company_name: string
  company_candidate_id: string
  full_name: string
  normalized_name: string
  title: string | null
  company_contact_id: string
  website_url: string | null
}

export type ProfessionalIdentityCorroborationMetrics = {
  persons_processed: number
  persons_corroborated: number
  titles_strengthened: number
  linkedin_urls_discovered: number
  committee_members_promoted: number
  channel_jobs_enqueued: number
  verified_channels_promoted: number
}
