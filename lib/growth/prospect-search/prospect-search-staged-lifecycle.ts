/** Staged Prospect Search lifecycle — client-safe criteria keys and honest pending states. */

import { buildProspectSearchEstimateCriteriaKey } from "@/lib/growth/prospect-search/prospect-search-estimate-visibility"
import type { GrowthProspectSearchDiscoveryMode, GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROSPECT_SEARCH_TRUTHFUL_LIFECYCLE_QA_MARKER =
  "growth-prospect-search-truthful-lifecycle-v1" as const

export const GROWTH_PROSPECT_SEARCH_NO_PRESEARCH_COUNTS_QA_MARKER =
  "growth-prospect-search-no-presearch-counts-v1" as const

export const GROWTH_PROSPECT_SEARCH_STAGED_SEARCH_QA_MARKER =
  "growth-prospect-search-staged-search-v1" as const

export function buildProspectSearchCriteriaKey(
  query: string,
  filters: GrowthProspectSearchFilters,
): string {
  return buildProspectSearchEstimateCriteriaKey(query, filters)
}

export function isProspectSearchCriteriaStale(
  currentCriteriaKey: string,
  lastSearchedCriteriaKey: string | null,
): boolean {
  if (lastSearchedCriteriaKey == null) return false
  return currentCriteriaKey !== lastSearchedCriteriaKey
}

export function resolveProspectSearchStagedSearchPendingMessage(
  discoveryMode: GrowthProspectSearchDiscoveryMode,
): string {
  return discoveryMode === "discover_external"
    ? "Filters updated — click Search market"
    : "Filters updated — click Search"
}
