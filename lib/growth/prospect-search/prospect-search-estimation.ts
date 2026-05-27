import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { countProspectSearchMatchesInternal } from "@/lib/growth/prospect-search/prospect-search-count"
import {
  listDiscoveryProviderRuntimeControls,
} from "@/lib/growth/prospect-search/prospect-search-discovery-provider-controls"
import {
  buildProspectSearchButtonLabel,
  countActiveProspectSearchFilters,
  formatExactOrRangeLabel,
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
import { isProspectSearchMaterializedIndexAvailable } from "@/lib/growth/prospect-search/prospect-search-materialized-index"
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

function resolveEstimateState(input: {
  discovery_mode: GrowthProspectSearchDiscoveryMode
  exact_count: number | null
  confidence: GrowthProspectSearchEstimateConfidence
  provider_readiness: GrowthProspectSearchProviderReadiness
  active_filters: number
  cached: boolean
}): GrowthProspectSearchEstimateState {
  if (
    input.discovery_mode === "discover_external" &&
    !input.provider_readiness.external_discovery_available
  ) {
    return "provider_unavailable"
  }
  if (input.cached) return "using_cached_estimate"
  if (input.exact_count == null) return "ready"
  const count = input.exact_count
  if (count <= 0 && input.active_filters >= 4) return "filters_too_restrictive"
  if (count <= 0) return "no_likely_matches"
  if (count < 10 && input.active_filters >= 3 && input.confidence !== "high") {
    return "filters_too_restrictive"
  }
  return "ready"
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
  const sources: GrowthProspectSearchEstimateSource[] = []
  let exact_count: number | null = null
  let confidence: GrowthProspectSearchEstimateConfidence = "low"

  try {
    const materializedAvailable = await isProspectSearchMaterializedIndexAvailable(admin)
    exact_count = await countProspectSearchMatchesInternal(admin, {
      query: input.query,
      filters,
    })
    confidence = "high"
    sources.push(materializedAvailable ? "materialized_index" : "index_fallback")
  } catch {
    exact_count = null
    confidence = "low"
  }

  const active_filters = countActiveProspectSearchFilters(filters)
  const formatted = formatExactOrRangeLabel({
    exact_count,
    confidence,
    discovery_mode: input.discovery_mode,
  })
  const state = resolveEstimateState({
    discovery_mode: input.discovery_mode,
    exact_count,
    confidence,
    provider_readiness,
    active_filters,
    cached: false,
  })
  const filter_health_warnings = buildProspectSearchFilterHealthWarnings({
    filters,
    discovery_mode: input.discovery_mode,
  })
  const relax_suggestions = buildProspectSearchRelaxSuggestions({
    filters,
    discovery_mode: input.discovery_mode,
    estimated_count: exact_count,
  })
  const button = buildProspectSearchButtonLabel({
    state,
    discovery_mode: input.discovery_mode,
    exact_count,
    confidence,
    provider_readiness,
  })

  const estimate: GrowthProspectSearchLiveEstimate = {
    qa_marker: GROWTH_LIVE_ESTIMATED_RESULTS_QA_MARKER,
    estimation_state_marker: GROWTH_FILTER_ESTIMATION_STATE_QA_MARKER,
    preview_marker: GROWTH_SEARCH_RESULT_PREVIEW_QA_MARKER,
    state,
    confidence,
    discovery_mode: input.discovery_mode,
    exact_count,
    display_label: formatted.display_label,
    range_floor: formatted.range_floor,
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
