/**
 * Growth Engine runtime profile selectors (Phase 8G).
 * Delegates to @fuzor/configuration; Equipify import paths preserved.
 */

import {
  PLATFORM_RUNTIME_PROFILE_IDS,
  PLATFORM_RUNTIME_PROFILE_VERSION,
  PLATFORM_RUNTIME_PROFILES,
  getPlatformRuntimeProfile,
  listPlatformRuntimeProfileIds,
  resolvePlatformRuntimeProfileId,
  type PlatformRuntimeProfile,
  type PlatformRuntimeProfileId,
  type PlatformRuntimeProfileTierPolicy,
} from "@fuzor/configuration"

import type { GrowthFeatureKey, GrowthFeatureMode, GrowthFeatureTier } from "@/lib/growth/runtime/growth-feature-registry"

export const GROWTH_RUNTIME_PROFILE_VERSION = PLATFORM_RUNTIME_PROFILE_VERSION

export type GrowthRuntimeProfileId = PlatformRuntimeProfileId

export type GrowthRuntimeProfileTierPolicy = PlatformRuntimeProfileTierPolicy

export type GrowthRuntimeProfile = {
  readonly id: GrowthRuntimeProfileId
  readonly label: string
  readonly description: string
  readonly tierPolicy: Readonly<Record<GrowthFeatureTier, GrowthRuntimeProfileTierPolicy>>
  readonly featureOverrides?: Partial<Record<GrowthFeatureKey, { enabled?: boolean; mode?: GrowthFeatureMode }>>
}

export const GROWTH_RUNTIME_PROFILES =
  PLATFORM_RUNTIME_PROFILES as Readonly<Record<GrowthRuntimeProfileId, GrowthRuntimeProfile>>

export const GROWTH_RUNTIME_PROFILE_IDS = PLATFORM_RUNTIME_PROFILE_IDS

export const resolveGrowthRuntimeProfileId = resolvePlatformRuntimeProfileId

export function getGrowthRuntimeProfile(id?: GrowthRuntimeProfileId): GrowthRuntimeProfile {
  return getPlatformRuntimeProfile(id) as GrowthRuntimeProfile
}

export const listGrowthRuntimeProfileIds = listPlatformRuntimeProfileIds
