/** Discover-mode results UI state — client-safe. */

import type {
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchResult,
} from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_DISCOVER_READY_TO_SEARCH_QA_MARKER =
  "growth-discover-ready-to-search-v1" as const

export {
  GROWTH_DISCOVER_LIVE_ESTIMATE_QA_MARKER,
  GROWTH_DISCOVER_NO_CREDITS_ESTIMATE_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-estimation-types"

export { GROWTH_DISCOVER_RESULTS_TABLE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-discover-results"
export { GROWTH_DISCOVER_CONTACT_ROW_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-discover-results"
export { GROWTH_DISCOVER_COMPANY_INTELLIGENCE_PANEL_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-discover-results"

export type ProspectSearchDiscoverResultsPhase =
  | "ready_to_search"
  | "searching"
  | "has_results"
  | "no_raw_results"
  | "filters_hiding_results"

export function resolveRawProviderCount(result: GrowthProspectSearchResult | null): number | null {
  if (!result) return null
  const fromDiagnostics = result.external_filter_diagnostics?.raw_provider_count
  if (typeof fromDiagnostics === "number") return fromDiagnostics
  const fromRuntime = result.provider_runtime_diagnostics?.raw_result_count
  if (typeof fromRuntime === "number") return fromRuntime
  return result.companies.length
}

export function resolveProspectSearchDiscoverResultsPhase(input: {
  discoveryMode: GrowthProspectSearchDiscoveryMode
  isSearching: boolean
  searchCompleted: boolean
  filteredCount: number
  rawProviderCount: number | null
}): ProspectSearchDiscoverResultsPhase | null {
  if (input.discoveryMode !== "discover_external") return null
  if (input.isSearching) return "searching"
  if (!input.searchCompleted) return "ready_to_search"
  const raw = input.rawProviderCount ?? 0
  if (raw <= 0) return "no_raw_results"
  if (input.filteredCount <= 0) return "filters_hiding_results"
  return "has_results"
}

export function shouldShowProspectSearchCleanStart(input: {
  discoveryMode: GrowthProspectSearchDiscoveryMode
  hasSearched: boolean
  searchCompleted: boolean
}): boolean {
  if (input.discoveryMode === "discover_external") return false
  return !input.hasSearched
}

export function shouldShowProspectSearchResultsCount(input: {
  discoveryMode: GrowthProspectSearchDiscoveryMode
  searchCompleted: boolean
  hasSearched: boolean
  loading: boolean
  criteriaStale?: boolean
}): boolean {
  if (input.loading || input.criteriaStale) return false
  if (input.discoveryMode === "discover_external") return input.searchCompleted
  return input.hasSearched
}

export function formatProspectSearchResultsCountLabel(input: {
  discoveryMode: GrowthProspectSearchDiscoveryMode
  searchCompleted: boolean
  totalCompanies: number
}): string {
  if (input.discoveryMode === "discover_external" && !input.searchCompleted) {
    return "Not searched yet"
  }
  return `${input.totalCompanies.toLocaleString()} companies found`
}
