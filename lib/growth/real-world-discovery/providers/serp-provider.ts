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
import {
  buildLiveProviderDiscoveryQueries,
  liveProviderIcpInputs,
} from "@/lib/growth/real-world-discovery/live-provider-query-expansion"
import { isSerpApiConfigured, searchSerpGoogleMaps } from "@/lib/growth/real-world-discovery/providers/serp-client"
import { mapSerpLocalResultToCandidate } from "@/lib/growth/real-world-discovery/providers/serp-mapper"

function serpDiagnostics(
  input: GrowthRealWorldDiscoveryProviderDiagnostics,
): GrowthRealWorldDiscoveryProviderDiagnostics {
  return input
}

type SerpCandidate = NonNullable<ReturnType<typeof mapSerpLocalResultToCandidate>>

async function runSerpQueryBatch(
  admin: SupabaseClient | null,
  queries: string[],
  limit: number,
): Promise<{
  candidates: SerpCandidate[]
  perQueryCacheResults: Awaited<ReturnType<typeof executeCachedRealWorldProviderQuery>>[]
  queryResultCounts: number[]
  executedQueries: string[]
}> {
  const candidates: SerpCandidate[] = []
  const perQueryCacheResults: Awaited<ReturnType<typeof executeCachedRealWorldProviderQuery>>[] = []
  const queryResultCounts: number[] = []
  const executedQueries: string[] = []
  const perQueryLimit = Math.min(20, Math.max(5, Math.ceil(limit / Math.max(queries.length, 1))))

  for (const textQuery of queries) {
    executedQueries.push(textQuery)
    const cachedQuery = await executeCachedRealWorldProviderQuery(
      { admin },
      {
        providerName: "serp",
        query: textQuery,
        queryInput: { limit: perQueryLimit },
        executeLive: async () => {
          const rows = await searchSerpGoogleMaps(textQuery, { limit: perQueryLimit })
          return rows
            .map((row, index) =>
              mapSerpLocalResultToCandidate(row, { query: textQuery, source_rank: index + 1 }),
            )
            .filter((row): row is NonNullable<typeof row> => row !== null)
        },
      },
    )

    perQueryCacheResults.push(cachedQuery)
    queryResultCounts.push(cachedQuery.candidates.length)
    candidates.push(...cachedQuery.candidates)
  }

  return { candidates, perQueryCacheResults, queryResultCounts, executedQueries }
}

function dedupeSerpCandidates(candidates: SerpCandidate[]): SerpCandidate[] {
  const seen = new Set<string>()
  const out: SerpCandidate[] = []
  for (const row of candidates) {
    const key = (row.domain ?? row.company_name ?? row.dedupe_hash).trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

/** SerpAPI Google Maps — multi-query expansion + cache. */
export function createRealWorldSerpProvider(options?: {
  admin?: SupabaseClient | null
}): GrowthRealWorldDiscoveryProvider {
  const admin = options?.admin ?? null

  return {
    provider_name: "serp",
    provider_type: "serp",
    isConfigured: () => isSerpApiConfigured(),
    discover: async (input: GrowthRealWorldDiscoveryQuery) => {
      const icp = liveProviderIcpInputs(input)
      const plan = buildLiveProviderDiscoveryQueries(icp)
      const limit = input.limit ?? 20
      const started = performance.now()
      let perQueryCacheResults: Awaited<ReturnType<typeof executeCachedRealWorldProviderQuery>>[] = []
      let queryResultCounts: number[] = []
      let executedQueries = plan.queries

      try {
        let batch = await runSerpQueryBatch(admin, plan.queries, limit)
        perQueryCacheResults = batch.perQueryCacheResults
        queryResultCounts = batch.queryResultCounts
        executedQueries = batch.executedQueries

        let candidates = dedupeSerpCandidates(batch.candidates).slice(0, limit)

        if (candidates.length === 0 && plan.fallback_queries.length > 0) {
          const fallbackBatch = await runSerpQueryBatch(admin, plan.fallback_queries, limit)
          perQueryCacheResults = [...perQueryCacheResults, ...fallbackBatch.perQueryCacheResults]
          queryResultCounts = [...queryResultCounts, ...fallbackBatch.queryResultCounts]
          executedQueries = [...executedQueries, ...fallbackBatch.executedQueries]
          candidates = dedupeSerpCandidates([...batch.candidates, ...fallbackBatch.candidates]).slice(0, limit)
        }

        const cacheStats = buildRealWorldProviderCacheDiagnostics(
          perQueryCacheResults,
          Math.round(performance.now() - started),
        )

        return {
          provider_name: "serp",
          provider_type: "serp",
          status: "success",
          message: candidates.length
            ? `${candidates.length} listing(s) from SerpAPI Google Maps across ${executedQueries.length} queries${cacheStats.provider_cache_hit ? " (cache)" : ""}.`
            : `SerpAPI returned no matches across ${executedQueries.length} expanded queries.`,
          candidates,
          diagnostics: serpDiagnostics({
            provider_executed: cacheStats.provider_executed,
            provider_latency_ms: cacheStats.provider_latency_ms,
            provider_result_count: candidates.length,
            provider_fallback_reason: cacheStats.provider_fallback_reason,
            provider_query_generated: executedQueries,
            provider_query_result_count: queryResultCounts,
            provider_merged_result_count: candidates.length,
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
            provider_query_generated: executedQueries,
            provider_query_result_count: queryResultCounts,
            provider_merged_result_count: 0,
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
