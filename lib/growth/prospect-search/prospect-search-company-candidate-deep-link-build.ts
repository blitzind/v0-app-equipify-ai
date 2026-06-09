/** Prospect Search operator deep link result builder — client-safe. */

import {
  GROWTH_PROSPECT_SEARCH_QA_MARKER,
  type GrowthProspectSearchCompanyResult,
  type GrowthProspectSearchResult,
} from "@/lib/growth/prospect-search/prospect-search-types"

export function buildProspectSearchCompanyCandidateDeepLinkResult(
  company: GrowthProspectSearchCompanyResult,
  input: {
    company_candidate_id: string
    source_table: string
  },
): GrowthProspectSearchResult {
  return {
    qa_marker: GROWTH_PROSPECT_SEARCH_QA_MARKER,
    discovery_mode: "discover_external",
    query: company.company_name,
    parsed_query: {
      raw_query: company.company_name,
      keywords: [company.company_name],
      industry_hints: company.industry ? [company.industry] : [],
      location_hints: company.location ? [company.location] : [],
      employee_min: null,
      employee_max: null,
      title_hints: [],
    },
    filters: {},
    companies: [company],
    people: [],
    people_rows: [],
    total_companies: 1,
    total_people: 0,
    source_counts: {
      growth_lead: 0,
      lead_inbox: 0,
      crm_prospect: 0,
      crm_customer: 0,
      external_discovered: 1,
    },
    provider_messages: [
      `Operator deep link loaded ${input.source_table} candidate ${input.company_candidate_id}.`,
    ],
    provider_status_label: "Operator deep link",
    provider_status_message:
      "Company loaded from staging for Apollo operator review. No provider search, Apollo acquisition, enrollment, or outreach was triggered.",
    result_mode: "companies",
  }
}
