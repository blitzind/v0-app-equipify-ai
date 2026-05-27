import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildProviderQueryHash,
  normalizeProviderQuery,
  stableQueryInputJson,
} from "@/lib/growth/provider-cache/provider-cache-normalizer"
import {
  estimateProviderCost,
  providerCacheExpiresAt,
  isProviderCacheEnabled,
} from "@/lib/growth/provider-cache/provider-cache-cost"
import {
  getCachedProviderResponse,
  incrementCacheHit,
  readCachedCandidates,
  saveProviderResponse,
} from "@/lib/growth/provider-cache/provider-cache-repository"
import { isGrowthProviderCacheSchemaReady } from "@/lib/growth/provider-cache/provider-cache-schema-health"
import type {
  CachedProviderQueryResult,
  ProviderCacheableName,
} from "@/lib/growth/provider-cache/provider-cache-types"
import { cacheAgeMs } from "@/lib/growth/provider-cache/provider-cache-types"

/** Fetch cached provider query results or execute live and persist cache. */
export async function getCachedProviderResponseOrExecute<T>({
  admin,
  providerName,
  query,
  queryInput,
  executeLive,
}: {
  admin: SupabaseClient | null | undefined
  providerName: ProviderCacheableName
  query: string
  queryInput?: Record<string, unknown>
  executeLive: () => Promise<{ data: T; latencyMs: number }>
}): Promise<CachedProviderQueryResult<T>> {
  const normalized = normalizeProviderQuery(query)
  const queryHash = buildProviderQueryHash(providerName, normalized)
  const inputJson = stableQueryInputJson(queryInput ?? {})

  const schemaReady = admin ? await isGrowthProviderCacheSchemaReady(admin).catch(() => false) : false
  const cacheEnabled = isProviderCacheEnabled(providerName) && schemaReady && Boolean(admin)

  if (cacheEnabled && admin) {
    try {
      const cached = await getCachedProviderResponse(admin, providerName, queryHash)
      if (cached) {
        await incrementCacheHit(admin, cached.id).catch(() => undefined)
        const candidates = readCachedCandidates(cached)
        return {
          data: candidates as T,
          cache_hit: true,
          cache_age_ms: cacheAgeMs(cached),
          provider_executed: false,
          provider_latency_ms: 0,
          provider_cost_estimate: 0,
          provider_fallback_reason: "cache",
        }
      }
    } catch {
      // Fault isolation — fall through to live provider.
    }
  }

  const started = performance.now()
  const live = await executeLive()
  const latencyMs = live.latencyMs ?? Math.round(performance.now() - started)
  const cost = estimateProviderCost(providerName, 1)

  if (cacheEnabled && admin) {
    try {
      const payload = {
        candidates: Array.isArray(live.data) ? live.data : live.data,
        candidate_count: Array.isArray(live.data) ? live.data.length : 0,
      }
      await saveProviderResponse(admin, {
        provider_name: providerName,
        query_hash: queryHash,
        normalized_query: normalized,
        query_input_json: inputJson,
        response_summary: `${payload.candidate_count} candidate(s) for "${normalized}"`,
        candidate_count: payload.candidate_count,
        cached_result_json: payload,
        provider_latency_ms: latencyMs,
        provider_cost_estimate: cost,
        expires_at: providerCacheExpiresAt(providerName),
      })
    } catch {
      // Cache write failure must not fail discovery.
    }
  }

  return {
    data: live.data,
    cache_hit: false,
    cache_age_ms: null,
    provider_executed: true,
    provider_latency_ms: latencyMs,
    provider_cost_estimate: cost,
    provider_fallback_reason: null,
  }
}

export {
  estimateProviderCost,
  isProviderCacheEnabled,
  mergeProviderQueryCacheStats,
  providerCacheExpiresAt,
  statsFromCachedQueryResults,
} from "@/lib/growth/provider-cache/provider-cache-cost"

export { isCacheValid, cacheAgeMs } from "@/lib/growth/provider-cache/provider-cache-types"
