import type {
  CachedProviderQueryResult,
  ProviderQueryCacheRunStats,
} from "@/lib/growth/provider-cache/provider-cache-types"
import {
  PROVIDER_CACHE_TTL_DAYS,
  PROVIDER_COST_ESTIMATE_USD,
} from "@/lib/growth/provider-cache/provider-cache-types"

export function estimateProviderCost(providerName: string, liveRequestCount = 1): number {
  const unit = PROVIDER_COST_ESTIMATE_USD[providerName] ?? 0.01
  return Number((unit * Math.max(0, liveRequestCount)).toFixed(4))
}

export function providerCacheExpiresAt(providerName: string, from = Date.now()): string {
  const days = PROVIDER_CACHE_TTL_DAYS[providerName] ?? 7
  return new Date(from + days * 24 * 60 * 60 * 1000).toISOString()
}

export function isProviderCacheEnabled(providerName: string): boolean {
  return providerName in PROVIDER_CACHE_TTL_DAYS
}

export function mergeProviderQueryCacheStats(
  rows: ProviderQueryCacheRunStats[],
): ProviderQueryCacheRunStats {
  if (!rows.length) {
    return {
      live_request_count: 0,
      cache_hit_count: 0,
      provider_cost_estimate: 0,
      average_latency_ms: 0,
      any_cache_hit: false,
      newest_cache_age_ms: null,
    }
  }

  const live_request_count = rows.reduce((sum, r) => sum + r.live_request_count, 0)
  const cache_hit_count = rows.reduce((sum, r) => sum + r.cache_hit_count, 0)
  const provider_cost_estimate = Number(
    rows.reduce((sum, r) => sum + r.provider_cost_estimate, 0).toFixed(4),
  )
  const latencyTotal = rows.reduce(
    (sum, r) => sum + r.average_latency_ms * Math.max(1, r.live_request_count + r.cache_hit_count),
    0,
  )
  const latencyCount = rows.reduce(
    (sum, r) => sum + Math.max(1, r.live_request_count + r.cache_hit_count),
    0,
  )
  const ages = rows
    .map((r) => r.newest_cache_age_ms)
    .filter((v): v is number => typeof v === "number")
  const newest_cache_age_ms = ages.length ? Math.min(...ages) : null

  return {
    live_request_count,
    cache_hit_count,
    provider_cost_estimate,
    average_latency_ms: latencyCount ? Math.round(latencyTotal / latencyCount) : 0,
    any_cache_hit: rows.some((r) => r.any_cache_hit),
    newest_cache_age_ms,
  }
}

export function statsFromCachedQueryResults(
  results: Array<
    Pick<CachedProviderQueryResult<unknown>, "cache_hit" | "provider_latency_ms" | "provider_cost_estimate">
  >,
): ProviderQueryCacheRunStats {
  const live_request_count = results.filter((r) => !r.cache_hit).length
  const cache_hit_count = results.filter((r) => r.cache_hit).length
  const provider_cost_estimate = Number(
    results.reduce((sum, r) => sum + r.provider_cost_estimate, 0).toFixed(4),
  )
  const latencyValues = results.map((r) => r.provider_latency_ms).filter((v) => v > 0)
  const average_latency_ms = latencyValues.length
    ? Math.round(latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length)
    : 0

  return {
    live_request_count,
    cache_hit_count,
    provider_cost_estimate,
    average_latency_ms,
    any_cache_hit: cache_hit_count > 0,
    newest_cache_age_ms: null,
  }
}
