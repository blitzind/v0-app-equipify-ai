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
import { getProspectSearchMaterializedIndexStats } from "@/lib/growth/prospect-search/prospect-search-materialized-index"
import {
  isGooglePlacesApiKeyConfigured,
  isSerpApiKeyConfigured,
} from "@/lib/growth/prospect-search/prospect-search-provider-runtime-diagnostics"
import type {
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"
import { parseSavedSearchWorkflowMetadata } from "@/lib/growth/prospect-search/saved-search-workflows"

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

async function loadCachedProviderEstimate(
  admin: SupabaseClient,
  query: string,
): Promise<{ count: number; source: GrowthProspectSearchEstimateSource } | null> {
  const needle = query.trim().slice(0, 80).toLowerCase()
  if (!needle) return null

  const { data, error } = await admin
    .schema("growth")
    .from("provider_query_cache")
    .select("candidate_count, normalized_query, cache_hit_count")
    .or(`normalized_query.ilike.%${needle.replace(/[%_]/g, "")}%`)
    .order("last_used_at", { ascending: false })
    .limit(5)

  if (error || !data?.length) return null

  const total = data.reduce((sum, row) => {
    const count =
      typeof (row as Record<string, unknown>).candidate_count === "number"
        ? ((row as Record<string, unknown>).candidate_count as number)
        : 0
    return sum + count
  }, 0)

  if (total <= 0) return null
  return { count: total, source: "provider_cache" }
}

async function loadSavedSearchEstimateHint(
  admin: SupabaseClient,
  input: { query: string; filters: GrowthProspectSearchFilters },
): Promise<{ count: number; source: GrowthProspectSearchEstimateSource } | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("prospect_search_saved_searches")
    .select("query_text, filters, metadata")
    .order("updated_at", { ascending: false })
    .limit(20)

  if (error || !data?.length) return null

  const queryNeedle = input.query.trim().toLowerCase()
  for (const row of data) {
    const record = row as Record<string, unknown>
    const savedQuery = typeof record.query_text === "string" ? record.query_text.trim().toLowerCase() : ""
    const workflow = parseSavedSearchWorkflowMetadata(record.metadata)
    if (workflow.discoveryMode === "discover_external") continue
    const similarQuery =
      !queryNeedle || savedQuery.includes(queryNeedle) || queryNeedle.includes(savedQuery)
    if (!similarQuery) continue
    if (typeof workflow.result_count === "number" && workflow.result_count > 0) {
      return { count: workflow.result_count, source: "saved_search_stats" }
    }
  }

  return null
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
  const count = input.exact_count ?? 0
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

  if (input.discovery_mode === "internal") {
    const internalCount = await countProspectSearchMatchesInternal(admin, {
      query: input.query,
      filters,
    })
    exact_count = internalCount
    confidence = "high"
    sources.push("materialized_index")
  } else {
    const [cacheHint, savedHint, indexStats] = await Promise.all([
      loadCachedProviderEstimate(admin, input.query),
      loadSavedSearchEstimateHint(admin, { query: input.query, filters }),
      getProspectSearchMaterializedIndexStats(admin).catch(() => ({ row_count: 0, last_indexed_at: null })),
    ])

    if (cacheHint) {
      exact_count = cacheHint.count
      confidence = "medium"
      sources.push(cacheHint.source)
    } else if (savedHint) {
      exact_count = savedHint.count
      confidence = "medium"
      sources.push(savedHint.source)
    } else {
      sources.push("provider_readiness_heuristic")
      const queryPresent = input.query.trim().length > 0
      const restrictive = countActiveProspectSearchFilters(filters)
      if (provider_readiness.external_discovery_available && queryPresent) {
        exact_count = restrictive >= 4 ? 10 : restrictive >= 2 ? 50 : 250
        confidence = "low"
      } else if (provider_readiness.external_discovery_available) {
        exact_count = 50
        confidence = "low"
      } else {
        exact_count = 0
        confidence = "low"
      }
      if (indexStats.row_count > 0 && exact_count != null) {
        sources.push("materialized_index")
      }
    }
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
