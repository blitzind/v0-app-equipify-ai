import type { GrowthProspectSearchCompanyResult, GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  applyProspectSearchFilters,
  explainProspectSearchFilterDrop,
} from "@/lib/growth/prospect-search/prospect-search-filters"

function isGeographyDropReason(reason: string | null): boolean {
  return reason === "location" || reason === "territory" || reason === "service_area"
}

function isKeywordDropReason(reason: string | null): boolean {
  return reason === "keywords"
}

function companyIdentityMissing(row: GrowthProspectSearchCompanyResult): boolean {
  const hasName = Boolean(row.company_name?.trim())
  const hasDomain = Boolean(row.website?.trim())
  return !hasName && !hasDomain
}

export type GrowthProspectSearchExternalFilterDiagnostics = {
  raw_provider_count: number
  normalized_result_count: number
  dropped_result_count: number
  dropped_reasons: Record<string, number>
  geography_accepted_count?: number
  geography_rejected_count?: number
  keyword_accepted_count?: number
  keyword_rejected_count?: number
  company_identity_missing_count?: number
}

export function applyProspectSearchExternalCompanyFilters(
  companies: GrowthProspectSearchCompanyResult[],
  filters: GrowthProspectSearchFilters,
): {
  companies: GrowthProspectSearchCompanyResult[]
  diagnostics: GrowthProspectSearchExternalFilterDiagnostics
} {
  const dropped_reasons: Record<string, number> = {}
  const kept: GrowthProspectSearchCompanyResult[] = []
  let geography_accepted_count = 0
  let geography_rejected_count = 0
  let keyword_accepted_count = 0
  let keyword_rejected_count = 0
  let company_identity_missing_count = 0

  for (const row of companies) {
    const reason = explainProspectSearchFilterDrop(row, filters, { external_discovery: true })
    if (companyIdentityMissing(row)) {
      company_identity_missing_count += 1
    }
    if (reason) {
      dropped_reasons[reason] = (dropped_reasons[reason] ?? 0) + 1
      if (isGeographyDropReason(reason)) {
        geography_rejected_count += 1
      } else if (isKeywordDropReason(reason)) {
        keyword_rejected_count += 1
      }
      continue
    }
    kept.push(row)
    geography_accepted_count += 1
    keyword_accepted_count += 1
  }

  return {
    companies: kept,
    diagnostics: {
      raw_provider_count: companies.length,
      normalized_result_count: kept.length,
      dropped_result_count: companies.length - kept.length,
      dropped_reasons,
      geography_accepted_count,
      geography_rejected_count,
      keyword_accepted_count,
      keyword_rejected_count,
      company_identity_missing_count,
    },
  }
}

/** Secondary pass — keep provider results when strict ICP filters removed everything. */
export function relaxProspectSearchExternalCompanyFilters(
  companies: GrowthProspectSearchCompanyResult[],
  filters: GrowthProspectSearchFilters,
): GrowthProspectSearchCompanyResult[] {
  if (companies.length === 0) return companies

  const relaxedFilters: GrowthProspectSearchFilters = {
    ...filters,
    employee_size_bands: undefined,
    revenue_bands: undefined,
    technologies: undefined,
    buying_stages: undefined,
    intent_score_min: undefined,
    lead_score_min: undefined,
    growth_signal_score_min: undefined,
    growth_signal_tiers: undefined,
    search_intent_categories: undefined,
  }

  return applyProspectSearchFilters(companies, relaxedFilters, { external_discovery: true })
}
