/** Client-safe Prospect Search live estimation types + QA markers. */

import type { GrowthProspectSearchDiscoveryMode } from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_LIVE_ESTIMATED_RESULTS_QA_MARKER =
  "growth-live-estimated-results-v1" as const

export const GROWTH_FILTER_ESTIMATION_STATE_QA_MARKER =
  "growth-filter-estimation-state-v1" as const

export const GROWTH_LIVE_RESULT_ESTIMATION_QA_MARKER =
  "growth-live-result-estimation-v1" as const

export const GROWTH_SEARCH_RESULT_PREVIEW_QA_MARKER =
  "growth-search-result-preview-v1" as const

export const GROWTH_PROVIDER_HEALTH_DASHBOARD_QA_MARKER =
  "growth-provider-health-dashboard-v1" as const

export type GrowthProspectSearchEstimateConfidence = "high" | "medium" | "low"

export type GrowthProspectSearchEstimateState =
  | "estimating"
  | "ready"
  | "no_likely_matches"
  | "filters_too_restrictive"
  | "provider_unavailable"
  | "using_cached_estimate"

export type GrowthProspectSearchEstimateSource =
  | "materialized_index"
  | "index_fallback"
  | "provider_cache"
  | "saved_search_stats"
  | "provider_readiness_heuristic"

export type GrowthProspectSearchProviderReadiness = {
  google_places: "available" | "unavailable" | "disabled"
  serp: "available" | "unavailable" | "disabled"
  any_live: boolean
  external_discovery_available: boolean
  label: string
}

export type GrowthProspectSearchLiveEstimate = {
  qa_marker: typeof GROWTH_LIVE_ESTIMATED_RESULTS_QA_MARKER
  estimation_state_marker: typeof GROWTH_FILTER_ESTIMATION_STATE_QA_MARKER
  preview_marker: typeof GROWTH_SEARCH_RESULT_PREVIEW_QA_MARKER
  state: GrowthProspectSearchEstimateState
  confidence: GrowthProspectSearchEstimateConfidence
  discovery_mode: GrowthProspectSearchDiscoveryMode
  exact_count: number | null
  display_label: string
  range_floor: number | null
  provider_readiness: GrowthProspectSearchProviderReadiness
  sources: GrowthProspectSearchEstimateSource[]
  cached: boolean
  filter_health_warnings: string[]
  relax_suggestions: string[]
  search_button_label: string
  search_button_disabled: boolean
}
