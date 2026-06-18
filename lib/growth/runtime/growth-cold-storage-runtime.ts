/**
 * Phase 8I — cold storage runtime diagnostics (in-process counters).
 */

import { listGrowthFeaturesByTier, type GrowthFeatureKey } from "@/lib/growth/runtime/growth-feature-registry"
import { GROWTH_TIER2_API_INVENTORY } from "@/lib/growth/runtime/growth-feature-api-map"
import { isGrowthFeatureApiEnabled } from "@/lib/growth/runtime/growth-feature-helpers"
import { resolveGrowthRuntimeProfileId } from "@/lib/growth/runtime/growth-runtime-profile"

export const GROWTH_COLD_STORAGE_RUNTIME_VERSION = "8i.1" as const

const disabledApiCounts: Partial<Record<GrowthFeatureKey, number>> = {}
const disabledPollerCounts: Partial<Record<string, number>> = {}
const disabledSubscriptionCounts: Partial<Record<string, number>> = {}
const disabledJobCounts: Partial<Record<GrowthFeatureKey, number>> = {}
const preventedSupabaseClientCounts: Partial<Record<GrowthFeatureKey, number>> = {}

export function recordGrowthColdStorageApiDisabled(feature: GrowthFeatureKey): void {
  disabledApiCounts[feature] = (disabledApiCounts[feature] ?? 0) + 1
  preventedSupabaseClientCounts[feature] = (preventedSupabaseClientCounts[feature] ?? 0) + 1
}

export function recordGrowthColdStorageCronSkipped(feature: GrowthFeatureKey): void {
  disabledJobCounts[feature] = (disabledJobCounts[feature] ?? 0) + 1
  preventedSupabaseClientCounts[feature] = (preventedSupabaseClientCounts[feature] ?? 0) + 1
}

export function recordGrowthColdStoragePollerDisabled(id: string): void {
  disabledPollerCounts[id] = (disabledPollerCounts[id] ?? 0) + 1
}

export function recordGrowthColdStorageSubscriptionDisabled(id: string): void {
  disabledSubscriptionCounts[id] = (disabledSubscriptionCounts[id] ?? 0) + 1
}

export function resetGrowthColdStorageRuntimeMetrics(): void {
  for (const key of Object.keys(disabledApiCounts)) delete disabledApiCounts[key as GrowthFeatureKey]
  for (const key of Object.keys(disabledPollerCounts)) delete disabledPollerCounts[key]
  for (const key of Object.keys(disabledSubscriptionCounts)) delete disabledSubscriptionCounts[key]
  for (const key of Object.keys(disabledJobCounts)) delete disabledJobCounts[key as GrowthFeatureKey]
  for (const key of Object.keys(preventedSupabaseClientCounts)) {
    delete preventedSupabaseClientCounts[key as GrowthFeatureKey]
  }
}

export function summarizeGrowthColdStorageRuntime(): {
  version: string
  profileId: ReturnType<typeof resolveGrowthRuntimeProfileId>
  activeFeatures: GrowthFeatureKey[]
  coldFeatures: GrowthFeatureKey[]
  disabledApis: Partial<Record<GrowthFeatureKey, number>>
  disabledPollers: Partial<Record<string, number>>
  disabledSubscriptions: Partial<Record<string, number>>
  disabledJobs: Partial<Record<GrowthFeatureKey, number>>
  preventedSupabaseClients: Partial<Record<GrowthFeatureKey, number>>
  estimatedSavings: {
    supabaseRequestsAvoidedPerHour: number
    dbConnectionsAvoidedPerHour: number
    diskIoScoreReduction: string
    browserNetworkRequestsAvoidedPerSession: number
  }
} {
  const profileId = resolveGrowthRuntimeProfileId()
  const tier1 = listGrowthFeaturesByTier(1)
  const tier2 = listGrowthFeaturesByTier(2)

  const activeFeatures = [...tier1, ...listGrowthFeaturesByTier(3)].filter((key) =>
    isGrowthFeatureApiEnabled(key),
  )
  const coldFeatures = tier2.filter((key) => !isGrowthFeatureApiEnabled(key))

  const highVolumeTier2Routes = GROWTH_TIER2_API_INVENTORY.filter(
    (row) => row.estimatedQueryVolume === "high",
  ).length

  const apiDisabledTotal = Object.values(disabledApiCounts).reduce((sum, n) => sum + (n ?? 0), 0)
  const pollerDisabledTotal = Object.values(disabledPollerCounts).reduce((sum, n) => sum + (n ?? 0), 0)

  return {
    version: GROWTH_COLD_STORAGE_RUNTIME_VERSION,
    profileId,
    activeFeatures,
    coldFeatures,
    disabledApis: { ...disabledApiCounts },
    disabledPollers: { ...disabledPollerCounts },
    disabledSubscriptions: { ...disabledSubscriptionCounts },
    disabledJobs: { ...disabledJobCounts },
    preventedSupabaseClients: { ...preventedSupabaseClientCounts },
    estimatedSavings: {
      supabaseRequestsAvoidedPerHour:
        profileId === "operator_minimal" ? 120 + highVolumeTier2Routes * 40 + pollerDisabledTotal * 2 : 0,
      dbConnectionsAvoidedPerHour:
        profileId === "operator_minimal" ? 24 + apiDisabledTotal + Object.keys(disabledJobCounts).length * 4 : 0,
      diskIoScoreReduction: profileId === "operator_minimal" ? "moderate (diagnostics + event bus queries suppressed)" : "none",
      browserNetworkRequestsAvoidedPerSession:
        profileId === "operator_minimal" ? 15 + pollerDisabledTotal : 0,
    },
  }
}
