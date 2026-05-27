import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthRealWorldDiscoveryProvider,
  GrowthRealWorldDiscoveryProviderDiagnostics,
  GrowthRealWorldDiscoveryQuery,
} from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"
import {
  buildRealWorldProviderCacheDiagnostics,
  executeCachedRealWorldProviderQuery,
} from "@/lib/growth/real-world-discovery/cached-real-world-provider-query"
import { isSerpApiConfigured, searchSerpGoogleMaps } from "@/lib/growth/real-world-discovery/providers/serp-client"
import { mapSerpLocalResultToCandidate } from "@/lib/growth/real-world-discovery/providers/serp-mapper"
import { buildSerpDiscoveryQuery } from "@/lib/growth/real-world-discovery/providers/serp-query-builder"

function serpDiagnostics(
  input: GrowthRealWorldDiscoveryProviderDiagnostics,
): GrowthRealWorldDiscoveryProviderDiagnostics {
  return input
}

/** SerpAPI Google Maps — official API only, no on-page scraping + cache. */
export function createRealWorldSerpProvider(options?: {
  admin?: SupabaseClient | null
}): GrowthRealWorldDiscoveryProvider {
  const admin = options?.admin ?? null

  return {
    provider_name: "serp",
    provider_type: "serp",
    isConfigured: () => isSerpApiConfigured(),
    discover: async (input: GrowthRealWorldDiscoveryQuery) => {
      const textQuery = buildSerpDiscoveryQuery(input)
      const limit = input.limit ?? 20
      const started = performance.now()

      try {
        const cachedQuery = await executeCachedRealWorldProviderQuery(
          { admin },
          {
            providerName: "serp",
            query: textQuery,
            queryInput: { limit },
            executeLive: async () => {
              const rows = await searchSerpGoogleMaps(textQuery, { limit })
              return rows
                .map((row, index) =>
                  mapSerpLocalResultToCandidate(row, { query: textQuery, source_rank: index + 1 }),
                )
                .filter((row): row is NonNullable<typeof row> => row !== null)
            },
          },
        )

        const candidates = cachedQuery.candidates
        const cacheStats = buildRealWorldProviderCacheDiagnostics(
          [cachedQuery],
          Math.round(performance.now() - started),
        )

        return {
          provider_name: "serp",
          provider_type: "serp",
          status: "success",
          message: candidates.length
            ? `${candidates.length} listing(s) from SerpAPI Google Maps${cachedQuery.cache_hit ? " (cache)" : ""}.`
            : `SerpAPI returned no matches for "${textQuery}".`,
          candidates,
          diagnostics: serpDiagnostics({
            provider_executed: cacheStats.provider_executed,
            provider_latency_ms: cacheStats.provider_latency_ms,
            provider_result_count: candidates.length,
            provider_fallback_reason: cacheStats.provider_fallback_reason,
            provider_cache_hit: cacheStats.provider_cache_hit,
            provider_cache_age_ms: cacheStats.provider_cache_age_ms,
            provider_cost_estimate: cacheStats.provider_cost_estimate,
            provider_live_request_count: cacheStats.provider_live_request_count,
            provider_cache_hit_count: cacheStats.provider_cache_hit_count,
          }),
        }
      } catch (err) {
        return {
          provider_name: "serp",
          provider_type: "serp",
          status: "failed",
          message: err instanceof Error ? err.message : "SerpAPI request failed.",
          candidates: [],
          error: err instanceof Error ? err.message : String(err),
          diagnostics: serpDiagnostics({
            provider_executed: true,
            provider_latency_ms: Math.round(performance.now() - started),
            provider_result_count: 0,
            provider_fallback_reason: err instanceof Error ? err.message : "SerpAPI request failed.",
            provider_cost_estimate: 0,
            provider_live_request_count: 0,
            provider_cache_hit_count: 0,
            provider_cache_hit: false,
            provider_cache_age_ms: null,
          }),
        }
      }
    },
  }
}
