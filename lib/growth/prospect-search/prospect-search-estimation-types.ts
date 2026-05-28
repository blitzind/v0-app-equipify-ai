/** Client-safe Prospect Search live estimation types + QA markers. */

import {
  GROWTH_MARKET_ESTIMATION_TIER_QA_MARKER,
  GROWTH_NO_FALSE_NEGATIVE_ESTIMATES_QA_MARKER,
  GROWTH_PRESEARCH_ESTIMATION_VS_RESULTS_QA_MARKER,
  type GrowthMarketEstimationTier,
} from "@/lib/growth/prospect-search/prospect-search-presearch-market-estimation"
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

export const GROWTH_DISCOVER_LIVE_ESTIMATE_QA_MARKER = "growth-discover-live-estimate-v1" as const
export const GROWTH_DISCOVER_NO_CREDITS_ESTIMATE_QA_MARKER =
  "growth-discover-no-credits-estimate-v1" as const

export type GrowthProspectSearchEstimateFromSource = "internal_index" | "cached_metadata" | "mixed"

export type GrowthProspectSearchEstimateConfidence = "high" | "medium" | "low" | "broad" | "heuristic"

export type GrowthProspectSearchEstimateState =
  | "estimating"
  | "ready"
  | "no_likely_matches"
  | "filters_too_restrictive"
  | "provider_unavailable"
  | "using_cached_estimate"
  | "presearch_broad_market"

export type GrowthProspectSearchEstimateSource =
  | "materialized_index"
  | "index_fallback"
  | "provider_cache"
  | "saved_search_stats"
  | "provider_readiness_heuristic"
  | "industry_breadth"
  | "query_category"
  | "market_heuristic"
  | "indexed_hint"

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
  presearch_market_qa_marker: typeof GROWTH_MARKET_ESTIMATION_TIER_QA_MARKER
  presearch_vs_results_qa_marker: typeof GROWTH_PRESEARCH_ESTIMATION_VS_RESULTS_QA_MARKER
  no_false_negative_qa_marker: typeof GROWTH_NO_FALSE_NEGATIVE_ESTIMATES_QA_MARKER
  phase: "presearch"
  state: GrowthProspectSearchEstimateState
  confidence: GrowthProspectSearchEstimateConfidence
  confidence_label: string
  discovery_mode: GrowthProspectSearchDiscoveryMode
  exact_count: number | null
  company_count: number | null
  contact_count: number | null
  decision_maker_count: number | null
  indexed_count_hint: number | null
  estimated_from: GrowthProspectSearchEstimateFromSource | null
  credits_used: false
  unavailable_filter_reasons: string[]
  numerical_headline: string
  market_tier: GrowthMarketEstimationTier | null
  broad_market_category: boolean
  display_label: string
  market_helper: string
  range_floor: number | null
  provider_readiness: GrowthProspectSearchProviderReadiness
  sources: GrowthProspectSearchEstimateSource[]
  cached: boolean
  filter_health_warnings: string[]
  relax_suggestions: string[]
  search_button_label: string
  search_button_disabled: boolean
}
