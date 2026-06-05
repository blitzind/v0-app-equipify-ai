/** Prospect Search — intelligence coverage metrics (7.PS-E). Client-safe. */

import type { GrowthProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-types"
import { GROWTH_COMPANY_INTELLIGENCE_CATEGORIES } from "@/lib/growth/company-intelligence/company-intelligence-types"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import {
  GROWTH_PROSPECT_SEARCH_COVERAGE_QA_MARKER,
  type ProspectSearchCompanyResolutionCoverage,
  type ProspectSearchContactLinkageCoverage,
  type ProspectSearchIntelligenceCoverage,
  type ProspectSearchIntelligenceCoverageMetrics,
} from "@/lib/growth/prospect-search/prospect-search-coverage-types"

export function companyResolutionConfidence(method: ProspectSearchCompanyResolutionCoverage["method"]): number {
  switch (method) {
    case "lead_metadata_canonical":
      return 1
    case "staging_candidate_id":
      return 0.94
    case "lead_staging_lineage":
      return 0.92
    case "staging_candidate_domain":
      return 0.9
    case "companies_primary_domain":
      return 0.88
    case "company_domains_alias":
      return 0.85
    case "unresolved":
    default:
      return 0
  }
}

export function personLinkageConfidence(method: ProspectSearchContactLinkageCoverage["method"]): number {
  switch (method) {
    case "overlay_hint":
      return 0.98
    case "company_contacts_column":
    case "lead_decision_makers_column":
    case "contact_candidates_column":
      return 0.95
    case "company_contacts_lineage":
    case "lead_decision_makers_lineage":
    case "contact_candidates_lineage":
      return 0.92
    case "committee_member_person_id":
      return 0.9
    case "unresolved":
    default:
      return 0
  }
}

export function buildProspectSearchIntelligenceCoverageMetrics(input: {
  company: ProspectSearchCompanyResolutionCoverage
  contacts: ProspectSearchContactLinkageCoverage[]
  engine_intelligence?: GrowthProspectSearchEngineIntelligence | null
}): ProspectSearchIntelligenceCoverageMetrics {
  const engine = input.engine_intelligence
  const contact_count = input.contacts.length
  const contacts_with_canonical_person = input.contacts.filter((c) => c.linked).length
  const canonical_person_coverage_pct =
    contact_count > 0 ? Math.round((contacts_with_canonical_person / contact_count) * 100) : 0

  const channels = engine?.verified_channels
  const committee = engine?.buying_committee
  const companyIntel = engine?.company_intelligence

  const categoryCount = companyIntel?.categories_present?.length ?? 0
  const intelligence_coverage_pct = companyIntel?.has_verified_intelligence
    ? Math.round((categoryCount / GROWTH_COMPANY_INTELLIGENCE_CATEGORIES.length) * 100)
    : 0

  return {
    canonical_company_linked: input.company.resolved,
    contact_count,
    contacts_with_canonical_person,
    canonical_person_coverage_pct,
    verified_channel_person_count: channels?.person_count ?? 0,
    verified_email_person_count: channels?.persons_with_verified_email ?? 0,
    verified_phone_person_count: channels?.persons_with_verified_phone ?? 0,
    verified_profile_person_count: channels?.persons_with_verified_profile ?? 0,
    committee_verified_member_count: committee?.verified_member_count ?? 0,
    committee_coverage_score: committee?.coverage_score ?? 0,
    company_intelligence_category_count: categoryCount,
    has_verified_company_intelligence: Boolean(companyIntel?.has_verified_intelligence),
    intelligence_coverage_pct,
  }
}

export function buildProspectSearchIntelligenceCoverage(input: {
  company: ProspectSearchCompanyResolutionCoverage
  contacts: ProspectSearchContactLinkageCoverage[]
  contact_intelligence?: GrowthProspectSearchContactIntelligence | null
}): ProspectSearchIntelligenceCoverage {
  const metrics = buildProspectSearchIntelligenceCoverageMetrics({
    company: input.company,
    contacts: input.contacts,
    engine_intelligence: input.contact_intelligence?.engine_intelligence,
  })

  return {
    qa_marker: GROWTH_PROSPECT_SEARCH_COVERAGE_QA_MARKER,
    company: input.company,
    contacts: input.contacts,
    metrics,
    unresolved_contact_count: input.contacts.filter((c) => c.unresolved_contact).length,
  }
}

export function aggregateProspectSearchCoverageMetrics(
  rows: Array<{ metrics: ProspectSearchIntelligenceCoverageMetrics }>,
): ProspectSearchIntelligenceCoverageMetrics & {
  account_count: number
  accounts_with_canonical_company: number
  accounts_with_verified_intelligence: number
} {
  const account_count = rows.length
  if (account_count === 0) {
    return {
      account_count: 0,
      accounts_with_canonical_company: 0,
      accounts_with_verified_intelligence: 0,
      canonical_company_linked: false,
      contact_count: 0,
      contacts_with_canonical_person: 0,
      canonical_person_coverage_pct: 0,
      verified_channel_person_count: 0,
      verified_email_person_count: 0,
      verified_phone_person_count: 0,
      verified_profile_person_count: 0,
      committee_verified_member_count: 0,
      committee_coverage_score: 0,
      company_intelligence_category_count: 0,
      has_verified_company_intelligence: false,
      intelligence_coverage_pct: 0,
    }
  }

  let contact_count = 0
  let contacts_with_canonical_person = 0
  let verified_channel_person_count = 0
  let verified_email_person_count = 0
  let verified_phone_person_count = 0
  let verified_profile_person_count = 0
  let committee_verified_member_count = 0
  let committee_coverage_score_sum = 0
  let category_count_sum = 0
  let accounts_with_canonical_company = 0
  let accounts_with_verified_intelligence = 0

  for (const row of rows) {
    const m = row.metrics
    if (m.canonical_company_linked) accounts_with_canonical_company += 1
    if (m.has_verified_company_intelligence) accounts_with_verified_intelligence += 1
    contact_count += m.contact_count
    contacts_with_canonical_person += m.contacts_with_canonical_person
    verified_channel_person_count += m.verified_channel_person_count
    verified_email_person_count += m.verified_email_person_count
    verified_phone_person_count += m.verified_phone_person_count
    verified_profile_person_count += m.verified_profile_person_count
    committee_verified_member_count += m.committee_verified_member_count
    committee_coverage_score_sum += m.committee_coverage_score
    category_count_sum += m.company_intelligence_category_count
  }

  return {
    account_count,
    accounts_with_canonical_company,
    accounts_with_verified_intelligence,
    canonical_company_linked: accounts_with_canonical_company > 0,
    contact_count,
    contacts_with_canonical_person,
    canonical_person_coverage_pct:
      contact_count > 0 ? Math.round((contacts_with_canonical_person / contact_count) * 100) : 0,
    verified_channel_person_count,
    verified_email_person_count,
    verified_phone_person_count,
    verified_profile_person_count,
    committee_verified_member_count,
    committee_coverage_score:
      account_count > 0 ? Number((committee_coverage_score_sum / account_count).toFixed(3)) : 0,
    company_intelligence_category_count:
      account_count > 0 ? Math.round(category_count_sum / account_count) : 0,
    has_verified_company_intelligence: accounts_with_verified_intelligence > 0,
    intelligence_coverage_pct:
      account_count > 0
        ? Math.round((accounts_with_verified_intelligence / account_count) * 100)
        : 0,
  }
}
