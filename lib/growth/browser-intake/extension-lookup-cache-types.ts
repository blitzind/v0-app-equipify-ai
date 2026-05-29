/** Growth Browser Extension lookup cache helpers — client-safe. */

export const GROWTH_BROWSER_EXTENSION_LOOKUP_CACHE_TTL_MS = 45_000 as const

export const GROWTH_BROWSER_EXTENSION_LOOKUP_CACHE_PREFIX = {
  crmContext: "crm_context",
  lookup: "lookup",
} as const

export type GrowthBrowserExtensionLookupCacheEntry<T> = {
  key: string
  value: T
  expires_at: number
}

export function buildGrowthBrowserExtensionLookupCacheKey(
  prefix: string,
  params: URLSearchParams | string,
): string {
  const serialized = typeof params === "string" ? params : params.toString()
  return `${prefix}:${serialized}`
}

export function readGrowthBrowserExtensionLookupCache<T>(
  cache: Map<string, GrowthBrowserExtensionLookupCacheEntry<T>>,
  key: string,
  now = Date.now(),
): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expires_at <= now) {
    cache.delete(key)
    return null
  }
  return entry.value
}

export function writeGrowthBrowserExtensionLookupCache<T>(
  cache: Map<string, GrowthBrowserExtensionLookupCacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number = GROWTH_BROWSER_EXTENSION_LOOKUP_CACHE_TTL_MS,
  now = Date.now(),
): void {
  cache.set(key, { key, value, expires_at: now + ttlMs })
}

export function invalidateGrowthBrowserExtensionLookupCache(
  cache: Map<string, GrowthBrowserExtensionLookupCacheEntry<unknown>>,
  prefix?: string,
): void {
  if (!prefix) {
    cache.clear()
    return
  }

  for (const key of cache.keys()) {
    if (key.startsWith(`${prefix}:`)) cache.delete(key)
  }
}
