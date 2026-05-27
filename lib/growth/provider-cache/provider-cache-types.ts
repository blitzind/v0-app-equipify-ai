/** Growth Engine — Provider query cache types (Prompt 30). Client-safe constants. */

export const GROWTH_PROVIDER_CACHE_QA_MARKER = "growth-provider-cache-v1" as const

export const PROVIDER_CACHE_TTL_DAYS: Record<string, number> = {
  google_places: 14,
  serp: 7,
  business_directory: 30,
}

export const PROVIDER_COST_ESTIMATE_USD: Record<string, number> = {
  google_places: 0.032,
  serp: 0.01,
  business_directory: 0.015,
}

export type ProviderCacheableName = "google_places" | "serp" | "business_directory"

export type ProviderQueryCacheRow = {
  id: string
  provider_name: string
  query_hash: string
  normalized_query: string
  query_input_json: Record<string, unknown>
  response_summary: string | null
  candidate_count: number
  cached_result_json: Record<string, unknown>
  provider_latency_ms: number | null
  provider_cost_estimate: number | null
  cache_hit_count: number
  created_at: string
  expires_at: string
  last_used_at: string
}

export type CachedProviderDiscoveryPayload = {
  candidates: unknown[]
  candidate_count: number
}

export type CachedProviderQueryResult<T> = {
  data: T
  cache_hit: boolean
  cache_age_ms: number | null
  provider_executed: boolean
  provider_latency_ms: number
  provider_cost_estimate: number
  provider_fallback_reason: string | null
}

export type ProviderQueryCacheRunStats = {
  live_request_count: number
  cache_hit_count: number
  provider_cost_estimate: number
  average_latency_ms: number
  any_cache_hit: boolean
  newest_cache_age_ms: number | null
}

export function isCacheValid(row: Pick<ProviderQueryCacheRow, "expires_at">, now = Date.now()): boolean {
  const expires = Date.parse(row.expires_at)
  return Number.isFinite(expires) && expires > now
}

export function cacheAgeMs(row: Pick<ProviderQueryCacheRow, "created_at">, now = Date.now()): number {
  const created = Date.parse(row.created_at)
  if (!Number.isFinite(created)) return 0
  return Math.max(0, now - created)
}
