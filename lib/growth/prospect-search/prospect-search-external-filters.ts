import type { GrowthProspectSearchCompanyResult, GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  applyProspectSearchFilters,
  explainProspectSearchFilterDrop,
} from "@/lib/growth/prospect-search/prospect-search-filters"

export type GrowthProspectSearchExternalFilterDiagnostics = {
  raw_provider_count: number
  normalized_result_count: number
  dropped_result_count: number
  dropped_reasons: Record<string, number>
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

  for (const row of companies) {
    const reason = explainProspectSearchFilterDrop(row, filters, { external_discovery: true })
    if (reason) {
      dropped_reasons[reason] = (dropped_reasons[reason] ?? 0) + 1
      continue
    }
    kept.push(row)
  }

  return {
    companies: kept,
    diagnostics: {
      raw_provider_count: companies.length,
      normalized_result_count: kept.length,
      dropped_result_count: companies.length - kept.length,
      dropped_reasons,
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
  }

  return applyProspectSearchFilters(companies, relaxedFilters)
}
