import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { hasActiveTerritoryFilter } from "@/lib/growth/prospect-search/prospect-search-geo"
import {
  computeTerritoryFromSearchResults,
  loadTerritoryById,
  loadTerritoryScore,
  resolveTerritoryFilters,
} from "@/lib/growth/territory-intelligence/territory-repository"
import {
  buildTerritoryIntelligenceSummary,
  companyToTerritoryScoringInput,
} from "@/lib/growth/territory-intelligence/integrations/prospect-search-territory-overlay"
import { computeTerritoryScoreMetrics } from "@/lib/growth/territory-intelligence/territory-scoring"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type {
  GrowthTerritoryIntelligenceSummary,
} from "@/lib/growth/territory-intelligence/territory-intelligence-types"
import type { GrowthProspectSearchResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { isGrowthTerritoryIntelligenceSchemaReady } from "@/lib/growth/territory-intelligence/territory-intelligence-schema-health"

export async function applyTerritoryFiltersToSearchInput(
  admin: SupabaseClient,
  filters: import("@/lib/growth/prospect-search/prospect-search-types").GrowthProspectSearchFilters,
) {
  if (!(await isGrowthTerritoryIntelligenceSchemaReady(admin))) return filters
  if (!filters.territory_id) return filters
  return resolveTerritoryFilters(admin, filters)
}

export async function attachTerritoryIntelligenceToSearchResult(
  admin: SupabaseClient,
  result: GrowthProspectSearchResult,
  companies: GrowthProspectSearchCompanyResult[],
): Promise<GrowthProspectSearchResult> {
  const territoryId = result.filters.territory_id
  const hasTerritoryFilter = hasActiveTerritoryFilter(result.filters.territory_filter)

  if (!territoryId && !hasTerritoryFilter) return result

  if (territoryId && (await isGrowthTerritoryIntelligenceSchemaReady(admin))) {
    const territory = await loadTerritoryById(admin, territoryId)
    if (!territory) return result

    let score = await loadTerritoryScore(admin, territoryId)
    if (!score) {
      score = await computeTerritoryFromSearchResults(admin, territoryId, companies)
    }

    const territory_intelligence = buildTerritoryIntelligenceSummary({
      territory_id: territory.id,
      territory_name: territory.name,
      score,
    })

    return { ...result, territory_intelligence }
  }

  if (hasTerritoryFilter && companies.length > 0) {
    const metrics = computeTerritoryScoreMetrics(companies.map(companyToTerritoryScoringInput))
    const territory_intelligence: GrowthTerritoryIntelligenceSummary = {
      territory_id: "ephemeral",
      territory_name: "Current search territory",
      territory_opportunity_score: metrics.territory_opportunity_score,
      whitespace_score: metrics.whitespace_score,
      company_count: metrics.company_count,
      mapped_company_count: metrics.mapped_company_count,
      high_fit_count: metrics.high_fit_count,
      contact_coverage_avg: metrics.contact_coverage_avg,
      growth_signal_density: metrics.growth_signal_density,
      existing_customer_count: metrics.existing_customer_count,
      existing_prospect_count: metrics.existing_prospect_count,
      suppressed_count: metrics.suppressed_count,
      cluster_count: metrics.clusters.length,
      top_signal_companies: metrics.top_signal_companies,
      last_computed_at: new Date().toISOString(),
    }
    return { ...result, territory_intelligence }
  }

  return result
}

export type { GrowthTerritoryIntelligenceSummary }
