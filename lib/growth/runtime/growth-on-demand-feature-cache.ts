/**
 * Phase 8K — shared Tier 3 on-demand cache (session-scoped, keyed by feature + scope).
 */

import type { GrowthFeatureKey } from "@/lib/growth/runtime/growth-feature-registry"

export type GrowthOnDemandFeatureStatus = "idle" | "loading" | "loaded" | "error"

type GrowthOnDemandCacheEntry = {
  status: GrowthOnDemandFeatureStatus
  error: string | null
  loadedAt: number | null
}

const cache = new Map<string, GrowthOnDemandCacheEntry>()

export function buildGrowthOnDemandCacheKey(feature: GrowthFeatureKey, scopeKey: string | null | undefined): string {
  return `${feature}:${scopeKey ?? "__global__"}`
}

export function readGrowthOnDemandCacheEntry(key: string): GrowthOnDemandCacheEntry | null {
  return cache.get(key) ?? null
}

export function writeGrowthOnDemandCacheEntry(key: string, patch: Partial<GrowthOnDemandCacheEntry>): GrowthOnDemandCacheEntry {
  const previous = cache.get(key) ?? { status: "idle" as const, error: null, loadedAt: null }
  const next = { ...previous, ...patch }
  cache.set(key, next)
  return next
}

export function clearGrowthOnDemandCacheEntry(key: string): void {
  cache.delete(key)
}

export function resetGrowthOnDemandFeatureCache(): void {
  cache.clear()
}

export function isGrowthOnDemandCacheLoaded(key: string): boolean {
  return cache.get(key)?.status === "loaded"
}
