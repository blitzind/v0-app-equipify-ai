import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { applyProspectSearchFilters, normalizeProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-filters"
import { buildProspectSearchIndex } from "@/lib/growth/prospect-search/prospect-search-index"
import {
  isProspectSearchMaterializedIndexAvailable,
  loadProspectSearchMaterializedCompanies,
} from "@/lib/growth/prospect-search/prospect-search-materialized-index"
import {
  mergeParsedQueryIntoFilters,
  parseProspectSearchQuery,
} from "@/lib/growth/prospect-search/prospect-search-query-parser"
import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  aggregateTerritoryOpportunityHeatmap,
  indexCompanyToTerritoryHeatmapInput,
  type GrowthTerritoryOpportunityBucketDimension,
  type GrowthTerritoryOpportunityHeatmapResult,
} from "@/lib/growth/prospect-search/territory-opportunity-heatmap"
import { applyTerritoryFiltersToSearchInput } from "@/lib/growth/territory-intelligence/integrations/prospect-search-bridge"

export async function loadTerritoryOpportunityHeatmap(
  admin: SupabaseClient,
  input: {
    query: string
    filters?: Partial<GrowthProspectSearchFilters>
    bucket_dimension?: GrowthTerritoryOpportunityBucketDimension
    saved_search_restored?: boolean
  },
): Promise<GrowthTerritoryOpportunityHeatmapResult> {
  const parsed = parseProspectSearchQuery(input.query)
  const baseFilters = mergeParsedQueryIntoFilters(parsed, input.filters ?? {}) as GrowthProspectSearchFilters
  const mergedFilters = normalizeProspectSearchFilters(
    await applyTerritoryFiltersToSearchInput(admin, baseFilters),
  )

  const materializedAvailable = await isProspectSearchMaterializedIndexAvailable(admin)
  let indexCompanies

  if (materializedAvailable) {
    indexCompanies = await loadProspectSearchMaterializedCompanies(admin, {
      query: input.query,
      territory_filter: mergedFilters.territory_filter,
    })
  } else {
    const built = await buildProspectSearchIndex(admin, input.query)
    indexCompanies = built.companies
  }

  const filtered = applyProspectSearchFilters(indexCompanies, mergedFilters)
  const companies = filtered.map(indexCompanyToTerritoryHeatmapInput)

  return aggregateTerritoryOpportunityHeatmap({
    companies,
    filters: mergedFilters,
    bucket_dimension: input.bucket_dimension,
    savedSearchRestored: input.saved_search_restored === true,
  })
}

export async function loadTerritoryOpportunitySnapshotForSavedSearch(
  admin: SupabaseClient,
  input: { query: string; filters: GrowthProspectSearchFilters },
): Promise<{
  territory_opportunity_count: number
  best_territory_bucket: string | null
  territory_opportunity_score: number
}> {
  const heatmap = await loadTerritoryOpportunityHeatmap(admin, {
    query: input.query,
    filters: input.filters,
    saved_search_restored: true,
  })

  return {
    territory_opportunity_count: heatmap.summary.suppression_adjusted_opportunity_count,
    best_territory_bucket: heatmap.territories[0]?.label ?? null,
    territory_opportunity_score: heatmap.summary.opportunity_score,
  }
}
