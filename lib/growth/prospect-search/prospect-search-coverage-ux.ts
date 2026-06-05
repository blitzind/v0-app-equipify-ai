/** Prospect Search — coverage & resolution UX copy (7.PS-E). Client-safe. */

import type { ProspectSearchCompanyResolutionMethod } from "@/lib/growth/prospect-search/prospect-search-coverage-types"
import type { ProspectSearchPersonLinkageMethod } from "@/lib/growth/prospect-search/prospect-search-coverage-types"

export const GROWTH_PROSPECT_SEARCH_COVERAGE_UX_QA_MARKER =
  "growth-prospect-search-coverage-ux-7-ps-e-v1" as const

export const PROSPECT_SEARCH_COVERAGE_PANEL_TITLE = "Intelligence coverage & linkage"
export const PROSPECT_SEARCH_COVERAGE_METRICS_TITLE = "Coverage metrics"

export const PROSPECT_SEARCH_COMPANY_RESOLUTION_METHOD_LABELS: Record<
  ProspectSearchCompanyResolutionMethod,
  string
> = {
  lead_metadata_canonical: "Lead metadata canonical",
  lead_staging_lineage: "Lead staging lineage",
  staging_candidate_id: "Staging candidate ID",
  staging_candidate_domain: "Staging candidate domain",
  companies_primary_domain: "Primary domain match",
  company_domains_alias: "Domain alias match",
  unresolved: "Unresolved company",
}

export const PROSPECT_SEARCH_PERSON_LINKAGE_METHOD_LABELS: Record<
  ProspectSearchPersonLinkageMethod,
  string
> = {
  overlay_hint: "Overlay hint",
  company_contacts_column: "Company contact column",
  company_contacts_lineage: "Company contact lineage",
  lead_decision_makers_column: "Decision maker column",
  lead_decision_makers_lineage: "Decision maker lineage",
  contact_candidates_column: "Contact candidate column",
  contact_candidates_lineage: "Contact candidate lineage",
  committee_member_person_id: "Committee member",
  unresolved: "Unresolved contact",
}
