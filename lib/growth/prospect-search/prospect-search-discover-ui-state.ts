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

export function resolveDiscoverEmptyStateMessage(input: {
  provider_status_message?: string | null
  provider_status_label?: string | null
  hydration_summary?: string | null
  expanded_search_exhausted?: boolean
  raw_provider_count?: number | null
  filtered_count?: number
}): string {
  if (input.hydration_summary) {
    return `${input.hydration_summary} Discovered companies may still appear with partial intelligence.`
  }

  if (input.provider_status_message) {
    return input.provider_status_message
  }

  if (input.provider_status_label === "provider_key_missing") {
    return "Live discovery providers are not configured. Add GOOGLE_PLACES_API_KEY and/or SERPAPI_API_KEY, or broaden filters to use fixture fallback when no keys are set."
  }

  if (input.provider_status_label === "results_dropped_by_filters") {
    return "Providers returned matches but your filters removed every company. Broaden industry, location, or firmographic filters."
  }

  if (input.expanded_search_exhausted) {
    return "No companies found after expanded provider search. Try adding a location or broadening filters."
  }

  if ((input.raw_provider_count ?? 0) === 0) {
    return "No verified companies were discovered for this query. Try a broader location, different industry keywords, or check provider availability in diagnostics."
  }

  if ((input.filtered_count ?? 0) === 0) {
    return "Discovery returned raw matches but none passed verification or enrichment. Partial results may appear after relaxing filters."
  }

  return "No companies matched this external discovery search. Try broadening industry or location filters."
}
