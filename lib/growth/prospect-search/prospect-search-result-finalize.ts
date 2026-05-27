import { buildProspectSearchExplanations } from "@/lib/growth/prospect-search/prospect-search-explanations"
import {
  evaluateTerritoryMatch,
  formatTerritoryLocationLabel,
} from "@/lib/growth/prospect-search/prospect-search-geo"
import { deriveProspectSearchCompanyStatus } from "@/lib/growth/prospect-search/prospect-search-status"
import type { GrowthProspectSearchParsedQuery } from "@/lib/growth/prospect-search/prospect-search-types"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"

export function finalizeProspectSearchCompanyResult(
  row: GrowthProspectSearchCompanyResult,
  context?: {
    query?: string
    filters?: GrowthProspectSearchFilters
    parsed?: GrowthProspectSearchParsedQuery
  },
): GrowthProspectSearchCompanyResult {
  const status = deriveProspectSearchCompanyStatus(row)
  const merged = { ...row, ...status }
  const explanations = buildProspectSearchExplanations({
    row: merged,
    query: context?.query,
    filters: context?.filters,
    parsed: context?.parsed,
  })

  const territoryMatch = context?.filters?.territory_filter
    ? evaluateTerritoryMatch(
        {
          city: merged.city,
          state: merged.state,
          postal_code: merged.postal_code,
          country: merged.country,
          location: merged.location,
          service_area: merged.service_area,
          metro: merged.metro,
          lat: merged.lat,
          lng: merged.lng,
        },
        context.filters.territory_filter,
      )
    : { matches: true, reasons: [] as string[] }

  return {
    ...merged,
    matched_territory_label: territoryMatch.reasons[0] ?? formatTerritoryLocationLabel(merged),
    territory_match_reasons: territoryMatch.reasons,
    score_explanation_items: explanations.score_explanation_items,
    confidence_explanation_items: explanations.confidence_explanation_items,
    recommended_next_step_reason: explanations.recommended_next_step_reason,
  }
}
