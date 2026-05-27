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
import { searchGooglePlacesText } from "@/lib/growth/real-world-discovery/providers/google-places-client"
import { mapGooglePlaceToCandidate } from "@/lib/growth/real-world-discovery/providers/google-places-mapper"
import { mergeGooglePlacesCandidates } from "@/lib/growth/real-world-discovery/providers/google-places-merge"
import {
  buildGooglePlacesDiscoveryQueries,
  googlePlacesIcpInputs,
} from "@/lib/growth/real-world-discovery/providers/google-places-query-expansion"

function placesDiagnostics(
  input: GrowthRealWorldDiscoveryProviderDiagnostics,
): GrowthRealWorldDiscoveryProviderDiagnostics {
  return input
}

type GooglePlacesCandidate = NonNullable<ReturnType<typeof mapGooglePlaceToCandidate>>

async function runGooglePlacesQueryBatch(
  admin: SupabaseClient | null,
  icp: ReturnType<typeof googlePlacesIcpInputs>,
  queries: string[],
  perQueryLimit: number,
): Promise<{
  collected: GooglePlacesCandidate[]
  queryResultCounts: number[]
  perQueryCacheResults: Awaited<ReturnType<typeof executeCachedRealWorldProviderQuery>>[]
  executedQueries: string[]
}> {
  const collected: GooglePlacesCandidate[] = []
  const queryResultCounts: number[] = []
  const perQueryCacheResults: Awaited<ReturnType<typeof executeCachedRealWorldProviderQuery>>[] = []
  const executedQueries: string[] = []

  for (const textQuery of queries) {
    executedQueries.push(textQuery)
    const cachedQuery = await executeCachedRealWorldProviderQuery(
      { admin },
      {
        providerName: "google_places",
        query: textQuery,
        queryInput: { limit: perQueryLimit },
        executeLive: async () => {
          const places = await searchGooglePlacesText(textQuery, { limit: perQueryLimit })
          return places
            .map((place, index) =>
              mapGooglePlaceToCandidate(place, {
                query: textQuery,
                source_rank: index + 1,
                matched_queries: [textQuery],
              }),
            )
            .filter((row): row is NonNullable<typeof row> => row !== null)
        },
      },
    )

    perQueryCacheResults.push(cachedQuery)
    queryResultCounts.push(cachedQuery.candidates.length)
    collected.push(...cachedQuery.candidates)
  }

  return { collected, queryResultCounts, perQueryCacheResults, executedQueries }
}

/** Google Places Text Search — official API only, multi-query ICP expansion + cache. */
export function createRealWorldGooglePlacesProvider(options?: {
  admin?: SupabaseClient | null
}): GrowthRealWorldDiscoveryProvider {
  const admin = options?.admin ?? null

  return {
    provider_name: "google_places",
    provider_type: "google_places",
    isConfigured: () => Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim()),
    discover: async (input: GrowthRealWorldDiscoveryQuery) => {
      const icp = googlePlacesIcpInputs(input)
      const expansion = buildGooglePlacesDiscoveryQueries(icp)
      const totalLimit = input.limit ?? 50
      const perQueryLimit = Math.min(20, Math.max(5, Math.ceil(totalLimit / Math.max(expansion.queries.length, 1))))
      const started = performance.now()
      let queryResultCounts: number[] = []
      let perQueryCacheResults: Awaited<ReturnType<typeof executeCachedRealWorldProviderQuery>>[] = []
      let executedQueries = expansion.queries

      try {
        let batch = await runGooglePlacesQueryBatch(admin, icp, expansion.queries, perQueryLimit)
        queryResultCounts = batch.queryResultCounts
        perQueryCacheResults = batch.perQueryCacheResults
        executedQueries = batch.executedQueries

        let merged = mergeGooglePlacesCandidates(
          batch.collected.filter((row): row is NonNullable<typeof row> => row !== null),
          icp,
        ).slice(0, totalLimit)

        if (merged.length === 0 && (expansion.fallback_queries?.length ?? 0) > 0) {
          const fallbackBatch = await runGooglePlacesQueryBatch(
            admin,
            icp,
            expansion.fallback_queries ?? [],
            perQueryLimit,
          )
          queryResultCounts = [...queryResultCounts, ...fallbackBatch.queryResultCounts]
          perQueryCacheResults = [...perQueryCacheResults, ...fallbackBatch.perQueryCacheResults]
          executedQueries = [...executedQueries, ...fallbackBatch.executedQueries]
          merged = mergeGooglePlacesCandidates(
            [...batch.collected, ...fallbackBatch.collected].filter(
              (row): row is NonNullable<typeof row> => row !== null,
            ),
            icp,
          ).slice(0, totalLimit)
        }

        const cacheStats = buildRealWorldProviderCacheDiagnostics(
          perQueryCacheResults,
          Math.round(performance.now() - started),
        )

        return {
          provider_name: "google_places",
          provider_type: "google_places",
          status: "success",
          message: merged.length
            ? `${merged.length} merged listing(s) from Google Places across ${executedQueries.length} queries (${cacheStats.provider_cache_hit_count} cache hits, ${cacheStats.provider_live_request_count} live).`
            : `Google Places returned no matches across ${executedQueries.length} expanded queries.`,
          candidates: merged,
          diagnostics: placesDiagnostics({
            provider_executed: cacheStats.provider_executed,
            provider_latency_ms: cacheStats.provider_latency_ms,
            provider_result_count: merged.length,
            provider_fallback_reason: cacheStats.provider_fallback_reason,
            provider_query_generated: executedQueries,
            provider_query_result_count: queryResultCounts,
            provider_merged_result_count: merged.length,
            provider_cache_hit: cacheStats.provider_cache_hit,
            provider_cache_age_ms: cacheStats.provider_cache_age_ms,
            provider_cost_estimate: cacheStats.provider_cost_estimate,
            provider_live_request_count: cacheStats.provider_live_request_count,
            provider_cache_hit_count: cacheStats.provider_cache_hit_count,
          }),
        }
      } catch (err) {
        const cacheStats = buildRealWorldProviderCacheDiagnostics(
          perQueryCacheResults,
          Math.round(performance.now() - started),
        )
        return {
          provider_name: "google_places",
          provider_type: "google_places",
          status: "failed",
          message: err instanceof Error ? err.message : "Google Places request failed.",
          candidates: [],
          error: err instanceof Error ? err.message : String(err),
          diagnostics: placesDiagnostics({
            provider_executed: cacheStats.provider_executed,
            provider_latency_ms: cacheStats.provider_latency_ms,
            provider_result_count: 0,
            provider_fallback_reason: err instanceof Error ? err.message : "Google Places request failed.",
            provider_query_generated: executedQueries,
            provider_query_result_count: queryResultCounts,
            provider_merged_result_count: 0,
            provider_cache_hit: cacheStats.provider_cache_hit,
            provider_cache_age_ms: cacheStats.provider_cache_age_ms,
            provider_cost_estimate: cacheStats.provider_cost_estimate,
            provider_live_request_count: cacheStats.provider_live_request_count,
            provider_cache_hit_count: cacheStats.provider_cache_hit_count,
          }),
        }
      }
    },
  }
}
