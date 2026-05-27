import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { countProspectSearchMatchesInternal } from "@/lib/growth/prospect-search/prospect-search-count"
import {
  listDiscoveryProviderRuntimeControls,
} from "@/lib/growth/prospect-search/prospect-search-discovery-provider-controls"
import {
  buildProspectSearchButtonLabel,
  countActiveProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-estimation-format"
import {
  buildProspectSearchEstimateCacheKey,
  readProspectSearchEstimateCache,
  writeProspectSearchEstimateCache,
} from "@/lib/growth/prospect-search/prospect-search-estimation-cache"
import {
  GROWTH_FILTER_ESTIMATION_STATE_QA_MARKER,
  GROWTH_LIVE_ESTIMATED_RESULTS_QA_MARKER,
  GROWTH_SEARCH_RESULT_PREVIEW_QA_MARKER,
  type GrowthProspectSearchEstimateConfidence,
  type GrowthProspectSearchEstimateSource,
  type GrowthProspectSearchEstimateState,
  type GrowthProspectSearchLiveEstimate,
  type GrowthProspectSearchProviderReadiness,
} from "@/lib/growth/prospect-search/prospect-search-estimation-types"
import {
  buildProspectSearchFilterHealthWarnings,
  buildProspectSearchRelaxSuggestions,
} from "@/lib/growth/prospect-search/prospect-search-filter-health"
import { normalizeProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-filters"
import {
  computePresearchMarketEstimate,
  formatPresearchMarketHeadline,
  GROWTH_MARKET_ESTIMATION_TIER_QA_MARKER,
  GROWTH_NO_FALSE_NEGATIVE_ESTIMATES_QA_MARKER,
  GROWTH_PRESEARCH_ESTIMATION_VS_RESULTS_QA_MARKER,
  isBroadMarketCategory,
} from "@/lib/growth/prospect-search/prospect-search-presearch-market-estimation"
import {
  isGooglePlacesApiKeyConfigured,
  isSerpApiKeyConfigured,
} from "@/lib/growth/prospect-search/prospect-search-provider-runtime-diagnostics"
import type {
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"

function buildProviderReadiness(): GrowthProspectSearchProviderReadiness {
  const controls = listDiscoveryProviderRuntimeControls()
  const googleEnabled = controls.find((row) => row.provider_name === "google_places")
  const serpEnabled = controls.find((row) => row.provider_name === "serp")
  const googleKey = isGooglePlacesApiKeyConfigured()
  const serpKey = isSerpApiKeyConfigured()

  const google_places: GrowthProspectSearchProviderReadiness["google_places"] =
    !googleEnabled?.enabled
      ? "disabled"
      : googleKey
        ? "available"
        : "unavailable"
  const serp: GrowthProspectSearchProviderReadiness["serp"] = !serpEnabled?.enabled
    ? "disabled"
    : serpKey
      ? "available"
      : "unavailable"

  const any_live = google_places === "available" || serp === "available"

  const external_discovery_available = any_live

  let label = "Provider unavailable"
  if (external_discovery_available) {
    label = "Live providers available"
  } else if (google_places === "disabled" || serp === "disabled") {
    label = "Provider disabled"
  } else if (!googleKey && !serpKey) {
    label = "Provider unavailable"
  } else {
    label = "External discovery available"
  }

  return {
    google_places,
    serp,
    any_live,
    external_discovery_available,
    label,
  }
}

function resolvePresearchEstimateState(input: {
  discovery_mode: GrowthProspectSearchDiscoveryMode
  provider_readiness: GrowthProspectSearchProviderReadiness
  broad_market_category: boolean
  impossibly_restrictive: boolean
  cached: boolean
}): GrowthProspectSearchEstimateState {
  if (
    input.discovery_mode === "discover_external" &&
    !input.provider_readiness.external_discovery_available
  ) {
    return "provider_unavailable"
  }
  if (input.cached) return "using_cached_estimate"
  if (input.broad_market_category) return "presearch_broad_market"
  if (input.impossibly_restrictive) return "filters_too_restrictive"
  return "ready"
}

function mapPresearchConfidence(
  discovery_mode: GrowthProspectSearchDiscoveryMode,
  broad_market_category: boolean,
): GrowthProspectSearchEstimateConfidence {
  if (broad_market_category || discovery_mode === "discover_external") return "broad"
  return "heuristic"
}

export async function estimateProspectSearchMatches(
  admin: SupabaseClient,
  input: {
    query: string
    filters?: Partial<GrowthProspectSearchFilters>
    discovery_mode: GrowthProspectSearchDiscoveryMode
  },
): Promise<GrowthProspectSearchLiveEstimate> {
  const filters = normalizeProspectSearchFilters(input.filters ?? {})
  const filtersJson = JSON.stringify(filters)
  const cacheKey = buildProspectSearchEstimateCacheKey({
    query: input.query,
    filtersJson,
    discovery_mode: input.discovery_mode,
  })

  const cached = readProspectSearchEstimateCache<GrowthProspectSearchLiveEstimate>(cacheKey)
  if (cached) {
    return { ...cached, cached: true, state: "using_cached_estimate" }
  }

  const provider_readiness = buildProviderReadiness()
  let indexed_count_hint: number | null = null
  const indexSources: GrowthProspectSearchEstimateSource[] = []

  if (input.discovery_mode === "internal") {
    try {
      indexed_count_hint = await countProspectSearchMatchesInternal(admin, {
        query: input.query,
        filters,
      })
      indexSources.push("indexed_hint")
    } catch {
      indexed_count_hint = null
    }
  }

  const presearch = computePresearchMarketEstimate({
    query: input.query,
    filters,
    discovery_mode: input.discovery_mode,
    indexed_count_hint,
    provider_searchable: provider_readiness.external_discovery_available,
  })

  const marketCopy = formatPresearchMarketHeadline(presearch)
  const broad_market_category = isBroadMarketCategory(input.query, filters) || presearch.broad_market_category
  const confidence = mapPresearchConfidence(input.discovery_mode, broad_market_category)
  const state = resolvePresearchEstimateState({
    discovery_mode: input.discovery_mode,
    provider_readiness,
    broad_market_category,
    impossibly_restrictive: presearch.impossibly_restrictive,
    cached: false,
  })

  const sources: GrowthProspectSearchEstimateSource[] = [...presearch.sources, ...indexSources]
  const filter_health_warnings = buildProspectSearchFilterHealthWarnings({
    filters,
    discovery_mode: input.discovery_mode,
  })
  const relax_suggestions = buildProspectSearchRelaxSuggestions({
    filters,
    discovery_mode: input.discovery_mode,
    estimated_count: indexed_count_hint,
  })
  const button = buildProspectSearchButtonLabel({
    state,
    discovery_mode: input.discovery_mode,
    exact_count: null,
    confidence,
    provider_readiness,
    broad_market_category,
    market_tier: presearch.tier,
  })

  const estimate: GrowthProspectSearchLiveEstimate = {
    qa_marker: GROWTH_LIVE_ESTIMATED_RESULTS_QA_MARKER,
    estimation_state_marker: GROWTH_FILTER_ESTIMATION_STATE_QA_MARKER,
    preview_marker: GROWTH_SEARCH_RESULT_PREVIEW_QA_MARKER,
    presearch_market_qa_marker: GROWTH_MARKET_ESTIMATION_TIER_QA_MARKER,
    presearch_vs_results_qa_marker: GROWTH_PRESEARCH_ESTIMATION_VS_RESULTS_QA_MARKER,
    no_false_negative_qa_marker: GROWTH_NO_FALSE_NEGATIVE_ESTIMATES_QA_MARKER,
    phase: "presearch",
    state,
    confidence,
    confidence_label: marketCopy.confidence_label,
    discovery_mode: input.discovery_mode,
    exact_count: null,
    indexed_count_hint,
    market_tier: presearch.tier,
    broad_market_category,
    display_label: marketCopy.headline,
    market_helper: marketCopy.helper,
    range_floor: null,
    provider_readiness,
    sources,
    cached: false,
    filter_health_warnings,
    relax_suggestions,
    search_button_label: button.label,
    search_button_disabled: button.disabled,
  }

  writeProspectSearchEstimateCache(cacheKey, estimate)
  return estimate
}
