import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthRealWorldDiscoveryProviderRawCandidate } from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"
import {
  getCachedProviderResponseOrExecute,
} from "@/lib/growth/provider-cache/provider-cache-engine"
import {
  statsFromCachedQueryResults,
} from "@/lib/growth/provider-cache/provider-cache-cost"
import type {
  CachedProviderQueryResult,
  ProviderCacheableName,
  ProviderQueryCacheRunStats,
} from "@/lib/growth/provider-cache/provider-cache-types"

export type RealWorldCachedQueryContext = {
  admin?: SupabaseClient | null
}

export async function executeCachedRealWorldProviderQuery(
  ctx: RealWorldCachedQueryContext,
  input: {
    providerName: ProviderCacheableName
    query: string
    queryInput?: Record<string, unknown>
    executeLive: () => Promise<GrowthRealWorldDiscoveryProviderRawCandidate[]>
  },
): Promise<
  CachedProviderQueryResult<GrowthRealWorldDiscoveryProviderRawCandidate[]> & {
    candidates: GrowthRealWorldDiscoveryProviderRawCandidate[]
  }
> {
  const result = await getCachedProviderResponseOrExecute({
    admin: ctx.admin,
    providerName: input.providerName,
    query: input.query,
    queryInput: input.queryInput,
    executeLive: async () => {
      const started = performance.now()
      const candidates = await input.executeLive()
      return {
        data: candidates,
        latencyMs: Math.round(performance.now() - started),
      }
    },
  })

  const candidates = Array.isArray(result.data) ? result.data : []

  return {
    ...result,
    candidates,
  }
}

export function buildRealWorldProviderCacheDiagnostics(
  queryResults: Array<
    CachedProviderQueryResult<GrowthRealWorldDiscoveryProviderRawCandidate[]> & {
      candidates: GrowthRealWorldDiscoveryProviderRawCandidate[]
    }
  >,
  totalLatencyMs: number,
): ProviderQueryCacheRunStats & {
  provider_executed: boolean
  provider_cache_hit: boolean
  provider_cache_age_ms: number | null
  provider_latency_ms: number
  provider_cost_estimate: number
  provider_live_request_count: number
  provider_cache_hit_count: number
  provider_fallback_reason: string | null
} {
  const stats = statsFromCachedQueryResults(queryResults)
  const cacheAges = queryResults
    .map((r) => r.cache_age_ms)
    .filter((v): v is number => typeof v === "number")
  const newest_cache_age_ms = cacheAges.length ? Math.min(...cacheAges) : null
  const allCached = queryResults.length > 0 && queryResults.every((r) => r.cache_hit)
  const anyLive = queryResults.some((r) => r.provider_executed)

  return {
    ...stats,
    newest_cache_age_ms,
    provider_executed: anyLive,
    provider_cache_hit: stats.any_cache_hit,
    provider_cache_age_ms: newest_cache_age_ms,
    provider_latency_ms: totalLatencyMs,
    provider_cost_estimate: stats.provider_cost_estimate,
    provider_live_request_count: stats.live_request_count,
    provider_cache_hit_count: stats.cache_hit_count,
    provider_fallback_reason: allCached ? "cache" : null,
  }
}
