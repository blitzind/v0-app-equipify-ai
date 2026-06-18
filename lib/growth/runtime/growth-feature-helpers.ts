/**
 * Growth feature registry helpers (Phase 8G).
 *
 * Server-safe and client-safe — no `server-only`, no network I/O.
 * Classification helpers read static registry config.
 * Shell enforcement is opt-in via {@link isGrowthFeatureEffectiveEnabled} with `enforceProfile: true`
 * (wired in Phase 8H via {@link isGrowthFeatureShellMounted}).
 */

import {
  GROWTH_FEATURE_REGISTRY,
  GROWTH_FEATURE_REGISTRY_VERSION,
  type GrowthFeatureConfig,
  type GrowthFeatureKey,
  type GrowthFeatureMode,
} from "@/lib/growth/runtime/growth-feature-registry"
import {
  getGrowthRuntimeProfile,
  resolveGrowthRuntimeProfileId,
  type GrowthRuntimeProfile,
  type GrowthRuntimeProfileId,
} from "@/lib/growth/runtime/growth-runtime-profile"

export type GrowthFeatureEnforcementOptions = {
  /**
   * When true, applies runtime profile tier policy to effective enablement.
   * **Keep false in production until Phase 8H** — default preserves current runtime behavior.
   */
  enforceProfile?: boolean
}

export function isGrowthFeatureEnabled(key: GrowthFeatureKey): boolean {
  return GROWTH_FEATURE_REGISTRY[key].enabled
}

export function isGrowthFeatureActive(key: GrowthFeatureKey): boolean {
  return GROWTH_FEATURE_REGISTRY[key].mode === "active"
}

export function isGrowthFeatureCold(key: GrowthFeatureKey): boolean {
  return GROWTH_FEATURE_REGISTRY[key].mode === "cold_hidden_disabled"
}

export function isGrowthFeatureLazy(key: GrowthFeatureKey): boolean {
  return GROWTH_FEATURE_REGISTRY[key].mode === "lazy_on_demand"
}

export function isGrowthFeatureAdminOnly(key: GrowthFeatureKey): boolean {
  return GROWTH_FEATURE_REGISTRY[key].adminOnly === true
}

/** Phase 8I — server/client API enablement (profile-enforced). */
export function isGrowthFeatureApiEnabled(
  key: GrowthFeatureKey,
  options?: GrowthFeatureEnforcementOptions & {
    profileId?: GrowthRuntimeProfileId
    isPlatformAdmin?: boolean
  },
): boolean {
  const profileId = options?.isPlatformAdmin ? "full_admin" : options?.profileId
  return isGrowthFeatureEffectiveEnabled(key, { enforceProfile: true, ...options }, profileId)
}

/**
 * Effective enablement after optional profile enforcement.
 * Phase 8G default (`enforceProfile` omitted/false): always true — no behavior change.
 */
export function isGrowthFeatureEffectiveEnabled(
  key: GrowthFeatureKey,
  options?: GrowthFeatureEnforcementOptions,
  profileId?: GrowthRuntimeProfileId,
): boolean {
  if (!options?.enforceProfile) return true

  const profile = getGrowthRuntimeProfile(profileId)
  const config = GROWTH_FEATURE_REGISTRY[key]
  const override = profile.featureOverrides?.[key]

  if (override?.enabled !== undefined) return override.enabled
  if (config.tier === 2) {
    if (!profile.tierPolicy[2].visible) return false
    // Shell visibility under full_admin / development_all — mount even when catalog enabled=false.
    return true
  }
  return config.enabled
}

export function getGrowthFeatureEffectiveMode(
  key: GrowthFeatureKey,
  options?: GrowthFeatureEnforcementOptions,
  profileId?: GrowthRuntimeProfileId,
): GrowthFeatureMode {
  if (!options?.enforceProfile) {
    return GROWTH_FEATURE_REGISTRY[key].mode
  }

  const profile = getGrowthRuntimeProfile(profileId)
  const config = GROWTH_FEATURE_REGISTRY[key]
  const override = profile.featureOverrides?.[key]
  if (override?.mode) return override.mode
  return config.mode
}

export function getGrowthFeatureEffectiveConfig(
  key: GrowthFeatureKey,
  options?: GrowthFeatureEnforcementOptions,
  profileId?: GrowthRuntimeProfileId,
): GrowthFeatureConfig & { effectiveEnabled: boolean; effectiveMode: GrowthFeatureMode } {
  const base = GROWTH_FEATURE_REGISTRY[key]
  const effectiveEnabled = isGrowthFeatureEffectiveEnabled(key, options, profileId)
  const effectiveMode = getGrowthFeatureEffectiveMode(key, options, profileId)
  return {
    ...base,
    effectiveEnabled,
    effectiveMode,
  }
}

export function summarizeGrowthFeatureRuntime(options?: GrowthFeatureEnforcementOptions): {
  registryVersion: string
  profileId: GrowthRuntimeProfileId
  profile: GrowthRuntimeProfile
  enforcementActive: boolean
} {
  const profileId = resolveGrowthRuntimeProfileId()
  return {
    registryVersion: GROWTH_FEATURE_REGISTRY_VERSION,
    profileId,
    profile: getGrowthRuntimeProfile(profileId),
    enforcementActive: Boolean(options?.enforceProfile),
  }
}
