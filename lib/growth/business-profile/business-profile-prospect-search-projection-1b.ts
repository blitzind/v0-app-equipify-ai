/** GE-AIOS-SUPPORTED-SERVICE-VERTICALS-PROJECTION-1B — Business Profile → Prospect Search ICP inputs (client-safe). */

import { projectApprovedBusinessProfileToSupportedServiceVerticals } from "@/lib/growth/business-profile/business-profile-supported-service-verticals-projection"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_BUSINESS_PROFILE_PROSPECT_SEARCH_PROJECTION_1B_QA_MARKER =
  "ge-aios-business-profile-prospect-search-projection-1b-v1" as const

export function buildProspectSearchQueryFromBusinessProfile(
  profile: BusinessProfileDraftContent,
  companyName?: string | null,
): string {
  const projection = projectApprovedBusinessProfileToSupportedServiceVerticals(profile, companyName)
  const label = projection.prospectSearch.primaryQueryLabel
  const geo = projection.discoveryIntent.geography.state
    ? `${projection.discoveryIntent.geography.state} United States`
    : "United States"
  return `Find ${label} companies in ${geo}`
}

export function buildProspectSearchFiltersFromBusinessProfile(
  profile: BusinessProfileDraftContent,
): GrowthProspectSearchFilters {
  const projection = projectApprovedBusinessProfileToSupportedServiceVerticals(profile)
  const persona = projection.discoveryIntent.buyerRoles[0] ?? null
  return {
    industry: null,
    industry_aliases: projection.prospectSearch.industryAliases,
    supported_service_vertical_ids: projection.prospectSearch.supportedServiceVerticalIds,
    qualification_criteria: projection.prospectSearch.qualificationCriteria,
    operational_evidence_requirements: projection.prospectSearch.operationalEvidenceRequirements,
    location: projection.discoveryIntent.geography.state ?? projection.discoveryIntent.geography.country ?? null,
    keywords: projection.prospectSearch.operationalKeywords.slice(0, 8),
    naics_codes: projection.discoveryIntent.naicsCodes,
    excluded_naics_codes: projection.discoveryIntent.excludedNaicsCodes,
    sic_codes: projection.discoveryIntent.sicCodes,
    excluded_sic_codes: projection.discoveryIntent.excludedSicCodes,
    decision_maker_role: persona,
    title_contains: persona,
    employee_size_bands: undefined,
    suppression_mode: "exclude",
    existing_account_mode: "exclude",
  }
}
