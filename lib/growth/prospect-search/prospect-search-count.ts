import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  applyProspectSearchFilters,
  normalizeProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-filters"
import { buildProspectSearchIndex } from "@/lib/growth/prospect-search/prospect-search-index"
import {
  isProspectSearchMaterializedIndexAvailable,
  loadProspectSearchMaterializedCompanies,
} from "@/lib/growth/prospect-search/prospect-search-materialized-index"
import {
  mergeParsedQueryIntoFilters,
  parseProspectSearchQuery,
} from "@/lib/growth/prospect-search/prospect-search-query-parser"
import {
  buildSavedSearchWorkflowMetadata,
  parseSavedSearchWorkflowMetadata,
} from "@/lib/growth/prospect-search/saved-search-workflows"
import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"
import { applyTerritoryFiltersToSearchInput } from "@/lib/growth/territory-intelligence/integrations/prospect-search-bridge"

/** Count filtered matches using materialized index only — no provider calls, no overlays. */
export async function countProspectSearchMatchesInternal(
  admin: SupabaseClient,
  input: { query: string; filters?: Partial<GrowthProspectSearchFilters> },
): Promise<number> {
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

  return applyProspectSearchFilters(indexCompanies, mergedFilters).length
}
