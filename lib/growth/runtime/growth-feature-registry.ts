/**
 * Canonical Growth Engine runtime feature registry (Phase 8G).
 *
 * Single source of truth for capability tiers and cold-storage intent.
 * **Not enforced in Phase 8G** — routes, UI, polling, and APIs remain unchanged until Phase 8H wiring.
 */

import {
  PLATFORM_FEATURE_KEYS,
  PLATFORM_FEATURE_REGISTRY,
  PLATFORM_FEATURE_REGISTRY_VERSION,
  getPlatformFeatureConfig,
  listPlatformFeaturesByMode,
  listPlatformFeaturesByTier,
  type PlatformFeatureConfig,
  type PlatformFeatureKey,
  type PlatformFeatureMode,
  type PlatformFeatureRegistry,
  type PlatformFeatureTier,
} from "@fuzor/configuration"

export const GROWTH_FEATURE_REGISTRY_VERSION = PLATFORM_FEATURE_REGISTRY_VERSION

export type GrowthFeatureMode = PlatformFeatureMode

export type GrowthFeatureTier = PlatformFeatureTier

export type GrowthFeatureConfig = PlatformFeatureConfig

export type GrowthFeatureKey = PlatformFeatureKey

export type GrowthFeatureRegistry = PlatformFeatureRegistry

/** Static registry — documents intended runtime posture; enforcement is opt-in in Phase 8H+. */
export const GROWTH_FEATURE_REGISTRY = PLATFORM_FEATURE_REGISTRY

export const GROWTH_FEATURE_KEYS = PLATFORM_FEATURE_KEYS

export function getGrowthFeatureConfig(key: GrowthFeatureKey): GrowthFeatureConfig {
  return getPlatformFeatureConfig(key)
}

export function listGrowthFeaturesByTier(tier: GrowthFeatureTier): GrowthFeatureKey[] {
  return listPlatformFeaturesByTier(tier)
}

export function listGrowthFeaturesByMode(mode: GrowthFeatureMode): GrowthFeatureKey[] {
  return listPlatformFeaturesByMode(mode)
}
