import { buildProspectSearchExplanations } from "@/lib/growth/prospect-search/prospect-search-explanations"
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

  return {
    ...merged,
    score_explanation_items: explanations.score_explanation_items,
    confidence_explanation_items: explanations.confidence_explanation_items,
    recommended_next_step_reason: explanations.recommended_next_step_reason,
  }
}
