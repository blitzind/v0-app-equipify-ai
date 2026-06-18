/**
 * Phase 8H — shell-level cold storage guards (server-safe).
 */

import type { GrowthFeatureKey } from "@/lib/growth/runtime/growth-feature-registry"
import { isGrowthFeatureEffectiveEnabled } from "@/lib/growth/runtime/growth-feature-helpers"
import { listGrowthTier2ShellRoutes } from "@/lib/growth/runtime/growth-feature-shell-map"
import {
  getGrowthRuntimeProfile,
  resolveGrowthRuntimeProfileId,
  type GrowthRuntimeProfileId,
} from "@/lib/growth/runtime/growth-runtime-profile"

const ENFORCE = { enforceProfile: true } as const

function resolveShellProfileId(
  profileId?: GrowthRuntimeProfileId,
  isPlatformAdmin?: boolean,
): GrowthRuntimeProfileId {
  if (isPlatformAdmin) return "full_admin"
  return profileId ?? resolveGrowthRuntimeProfileId()
}

/** Whether a registry feature may mount in the current shell profile. */
export function isGrowthFeatureShellMounted(
  key: GrowthFeatureKey,
  context?: { profileId?: GrowthRuntimeProfileId; isPlatformAdmin?: boolean },
): boolean {
  const profileId = resolveShellProfileId(context?.profileId, context?.isPlatformAdmin)
  return isGrowthFeatureEffectiveEnabled(key, ENFORCE, profileId)
}

/** Tier 2 operator surfaces (e.g. inbox Operations tab). */
export function isGrowthTier2ShellVisible(context?: {
  profileId?: GrowthRuntimeProfileId
  isPlatformAdmin?: boolean
}): boolean {
  const profileId = resolveShellProfileId(context?.profileId, context?.isPlatformAdmin)
  return getGrowthRuntimeProfile(profileId).tierPolicy[2].visible
}

/** Next.js Link prefetch should be off for cold Tier 2 routes in operator_minimal. */
export function shouldDisableGrowthFeatureRoutePrefetch(
  href: string,
  context?: { profileId?: GrowthRuntimeProfileId; isPlatformAdmin?: boolean },
): boolean {
  if (isGrowthTier2ShellVisible(context)) return false
  return listGrowthTier2ShellRoutes().some((route) => href === route || href.startsWith(`${route}/`))
}
