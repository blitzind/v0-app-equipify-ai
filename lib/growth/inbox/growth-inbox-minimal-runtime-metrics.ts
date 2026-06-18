/**
 * Phase 8K — in-process client metrics for Inbox minimal runtime (production-safe counters).
 */

import type { GrowthFeatureKey } from "@/lib/growth/runtime/growth-feature-registry"

export const GROWTH_INBOX_MINIMAL_RUNTIME_METRICS_VERSION = "8k.1" as const

export type GrowthInboxMinimalRuntimeMetricsSnapshot = {
  version: typeof GROWTH_INBOX_MINIMAL_RUNTIME_METRICS_VERSION
  allowedInitialRequests: number
  blockedOrFlaggedInitialRequests: number
  allowedSelectedThreadRequests: number
  flaggedTier3EagerRequests: number
  tier2SoftDisabledRequests: number
  tier3OnDemandLoads: number
  tier3CacheHits: number
  tier3ManualRefreshes: number
  tier3LoadsByFeature: Partial<Record<GrowthFeatureKey, number>>
  flaggedRoutes: Array<{ pathname: string; reason: string; at: string }>
}

const metrics: GrowthInboxMinimalRuntimeMetricsSnapshot = {
  version: GROWTH_INBOX_MINIMAL_RUNTIME_METRICS_VERSION,
  allowedInitialRequests: 0,
  blockedOrFlaggedInitialRequests: 0,
  allowedSelectedThreadRequests: 0,
  flaggedTier3EagerRequests: 0,
  tier2SoftDisabledRequests: 0,
  tier3OnDemandLoads: 0,
  tier3CacheHits: 0,
  tier3ManualRefreshes: 0,
  tier3LoadsByFeature: {},
  flaggedRoutes: [],
}

const MAX_FLAGGED_ROUTES = 40

function pushFlaggedRoute(pathname: string, reason: string): void {
  metrics.flaggedRoutes.push({ pathname, reason, at: new Date().toISOString() })
  if (metrics.flaggedRoutes.length > MAX_FLAGGED_ROUTES) {
    metrics.flaggedRoutes.shift()
  }
}

export function resetGrowthInboxMinimalRuntimeMetrics(): void {
  metrics.allowedInitialRequests = 0
  metrics.blockedOrFlaggedInitialRequests = 0
  metrics.allowedSelectedThreadRequests = 0
  metrics.flaggedTier3EagerRequests = 0
  metrics.tier2SoftDisabledRequests = 0
  metrics.tier3OnDemandLoads = 0
  metrics.tier3CacheHits = 0
  metrics.tier3ManualRefreshes = 0
  metrics.tier3LoadsByFeature = {}
  metrics.flaggedRoutes = []
}

export function recordGrowthInboxAllowedInitialRequest(pathname: string): void {
  metrics.allowedInitialRequests += 1
  void pathname
}

export function recordGrowthInboxFlaggedInitialRequest(pathname: string, reason: string): void {
  metrics.blockedOrFlaggedInitialRequests += 1
  pushFlaggedRoute(pathname, reason)
}

export function recordGrowthInboxAllowedSelectedThreadRequest(pathname: string): void {
  metrics.allowedSelectedThreadRequests += 1
  void pathname
}

export function recordGrowthInboxFlaggedTier3EagerRequest(pathname: string, reason: string): void {
  metrics.flaggedTier3EagerRequests += 1
  pushFlaggedRoute(pathname, reason)
}

export function recordGrowthInboxTier2SoftDisabledRequest(pathname: string): void {
  metrics.tier2SoftDisabledRequests += 1
  void pathname
}

export function recordGrowthInboxTier3OnDemandLoad(feature: GrowthFeatureKey): void {
  metrics.tier3OnDemandLoads += 1
  metrics.tier3LoadsByFeature[feature] = (metrics.tier3LoadsByFeature[feature] ?? 0) + 1
}

export function recordGrowthInboxTier3CacheHit(feature: GrowthFeatureKey): void {
  metrics.tier3CacheHits += 1
  void feature
}

export function recordGrowthInboxTier3ManualRefresh(feature: GrowthFeatureKey): void {
  metrics.tier3ManualRefreshes += 1
  void feature
}

export function getGrowthInboxMinimalRuntimeMetrics(): GrowthInboxMinimalRuntimeMetricsSnapshot {
  return {
    ...metrics,
    tier3LoadsByFeature: { ...metrics.tier3LoadsByFeature },
    flaggedRoutes: [...metrics.flaggedRoutes],
  }
}
