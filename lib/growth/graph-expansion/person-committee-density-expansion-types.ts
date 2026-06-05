/** Phase 7.PS-HU — Person & committee density expansion types. Client-safe. */

import type { GrowthProspectGraphExpansionMetrics } from "@/lib/growth/graph-expansion/prospect-graph-expansion-types"

export const GROWTH_PERSON_COMMITTEE_DENSITY_EXPANSION_QA_MARKER =
  "growth-person-committee-density-expansion-7-ps-hu-v1" as const

export const GROWTH_PERSON_COMMITTEE_DENSITY_EXPANSION_CERTIFICATION_QA_MARKER =
  "growth-person-committee-density-expansion-certification-7-ps-hu-v1" as const

/** PS-HE anchor companies — always included in PS-HU certification cohort. */
export const GROWTH_PS_HE_ANCHOR_COMPANIES = [
  {
    company_candidate_id: "94bea025-d2df-4a13-ba6c-ec1476b6d050",
    canonical_company_id: "3620d561-8568-4104-a878-898bfec618ca",
    company_name: "Emergency Repair Biomedical",
    search_query: "biomedical equipment service companies",
    cohort_kind: "ps_he_anchor",
  },
  {
    company_candidate_id: "5ee5a006-6eb8-4890-8775-21d22af4af6e",
    canonical_company_id: "4456d3c3-900a-468f-ac33-aadabac67e52",
    company_name: "Biomedical Repair Service",
    search_query: "medical equipment repair companies",
    cohort_kind: "ps_he_anchor",
  },
  {
    company_candidate_id: "5a9a8ba4-1f8b-4ec6-9ebf-5607bbadf1ec",
    canonical_company_id: "dcf0c09b-c636-4f82-b511-2af45076630e",
    company_name: "ERS Biomedical Services",
    search_query: "biomedical equipment service companies",
    cohort_kind: "ps_he_anchor",
  },
] as const

export type PersonCommitteeDensityCohortKind = "ps_ht_new" | "ps_he_anchor"

export type PersonCommitteeDensityCohortCompany = {
  company_candidate_id: string
  canonical_company_id: string
  company_name: string
  search_query: string
  cohort_kind: PersonCommitteeDensityCohortKind
}

export type PersonCommitteeDensityCompanySnapshot = {
  canonical_company_id: string
  company_name: string
  cohort_kind: PersonCommitteeDensityCohortKind
  named_persons: number
  titled_persons: number
  committee_members_verified: number
  verified_emails: number
  verified_phones: number
  verified_profiles: number
  outreach_ready: boolean
}

export type PersonCommitteeDensityExpansionMetrics = {
  companies_processed: number
  companies_with_evidence: number
  named_persons_discovered: number
  named_persons_promoted: number
  titles_discovered: number
  titles_promoted: number
  emails_discovered: number
  phones_discovered: number
  social_profiles_discovered: number
  committee_members_promoted: number
  website_contacts_synced: number
  discovery_contacts_total: number
  channel_jobs_enqueued: number
}

export type PersonCommitteeDensityCompanyResult = {
  company_name: string
  canonical_company_id: string
  cohort_kind: PersonCommitteeDensityCohortKind
  ok: boolean
  before: PersonCommitteeDensityCompanySnapshot
  after: PersonCommitteeDensityCompanySnapshot
  acquisition: {
    discovery_contacts: number
    website_contacts_synced: number
    persons_linked: number
    company_contacts_synced: number
  }
  committee: {
    ran: boolean
    skipped_reason: string | null
    verified_member_count: number
    promoted_count: number
  }
  source_types_observed: string[]
  messages: string[]
}

export type PersonCommitteeDensityExpansionResult = {
  qa_marker: typeof GROWTH_PERSON_COMMITTEE_DENSITY_EXPANSION_QA_MARKER
  ok: boolean
  cohort: PersonCommitteeDensityCohortCompany[]
  metrics: PersonCommitteeDensityExpansionMetrics
  company_results: PersonCommitteeDensityCompanyResult[]
  cohort_metrics: {
    before: GrowthProspectGraphExpansionMetrics
    after: GrowthProspectGraphExpansionMetrics
    delta: Partial<GrowthProspectGraphExpansionMetrics>
  }
  outreach_ready_companies: {
    before: number
    after: number
    delta: number
  }
  messages: string[]
}
