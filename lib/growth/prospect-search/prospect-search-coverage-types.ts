/** Prospect Search — intelligence coverage & resolution diagnostics (Phase 7.PS-E). Client-safe. */

export const GROWTH_PROSPECT_SEARCH_COVERAGE_QA_MARKER =
  "growth-prospect-search-coverage-7-ps-e-v1" as const

export const PROSPECT_SEARCH_COMPANY_RESOLUTION_METHODS = [
  "lead_metadata_canonical",
  "lead_staging_lineage",
  "staging_candidate_id",
  "staging_candidate_domain",
  "companies_primary_domain",
  "company_domains_alias",
  "unresolved",
] as const

export type ProspectSearchCompanyResolutionMethod =
  (typeof PROSPECT_SEARCH_COMPANY_RESOLUTION_METHODS)[number]

export const PROSPECT_SEARCH_PERSON_LINKAGE_METHODS = [
  "overlay_hint",
  "company_contacts_column",
  "company_contacts_lineage",
  "lead_decision_makers_column",
  "lead_decision_makers_lineage",
  "contact_candidates_column",
  "contact_candidates_lineage",
  "committee_member_person_id",
  "unresolved",
] as const

export type ProspectSearchPersonLinkageMethod =
  (typeof PROSPECT_SEARCH_PERSON_LINKAGE_METHODS)[number]

export type ProspectSearchCompanyResolutionCoverage = {
  canonical_company_id: string | null
  resolved: boolean
  confidence: number
  method: ProspectSearchCompanyResolutionMethod
  reasons: string[]
  evidence: string[]
  unresolved_company: boolean
  normalized_domain: string | null
}

export type ProspectSearchContactLinkageCoverage = {
  contact_id: string
  canonical_person_id: string | null
  linked: boolean
  confidence: number
  method: ProspectSearchPersonLinkageMethod
  reasons: string[]
  evidence: string[]
  unresolved_contact: boolean
}

export type ProspectSearchIntelligenceCoverageMetrics = {
  canonical_company_linked: boolean
  contact_count: number
  contacts_with_canonical_person: number
  canonical_person_coverage_pct: number
  verified_channel_person_count: number
  verified_email_person_count: number
  verified_phone_person_count: number
  verified_profile_person_count: number
  committee_verified_member_count: number
  committee_coverage_score: number
  company_intelligence_category_count: number
  has_verified_company_intelligence: boolean
  intelligence_coverage_pct: number
  /** Phase 7.PS-HS — prospect graph expansion metrics overlay. */
  graph_expansion?: import("@/lib/growth/graph-expansion/prospect-graph-expansion-types").GrowthProspectGraphExpansionMetrics | null
}

export type ProspectSearchIntelligenceCoverage = {
  qa_marker: typeof GROWTH_PROSPECT_SEARCH_COVERAGE_QA_MARKER
  company: ProspectSearchCompanyResolutionCoverage
  contacts: ProspectSearchContactLinkageCoverage[]
  metrics: ProspectSearchIntelligenceCoverageMetrics
  unresolved_contact_count: number
}
