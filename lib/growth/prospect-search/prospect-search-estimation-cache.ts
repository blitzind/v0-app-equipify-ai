import "server-only"

import { createHash } from "node:crypto"

type CacheEntry<T> = {
  expires_at: number
  value: T
}

const ESTIMATE_CACHE_TTL_MS = 45_000
const estimateCache = new Map<string, CacheEntry<unknown>>()

export function buildProspectSearchEstimateCacheKey(input: {
  query: string
  filtersJson: string
  discovery_mode: string
}): string {
  return createHash("sha256")
    .update(`${input.discovery_mode}|${input.query}|${input.filtersJson}`)
    .digest("hex")
}

export function readProspectSearchEstimateCache<T>(key: string): T | null {
  const row = estimateCache.get(key)
  if (!row) return null
  if (Date.now() > row.expires_at) {
    estimateCache.delete(key)
    return null
  }
  return row.value as T
}

export function writeProspectSearchEstimateCache<T>(key: string, value: T): void {
  estimateCache.set(key, { value, expires_at: Date.now() + ESTIMATE_CACHE_TTL_MS })
  if (estimateCache.size > 200) {
    const oldest = estimateCache.keys().next().value
    if (oldest) estimateCache.delete(oldest)
  }
}

export function clearProspectSearchEstimateCache(): void {
  estimateCache.clear()
}

export const PROSPECT_SEARCH_ESTIMATE_CACHE_TTL_MS = ESTIMATE_CACHE_TTL_MS
