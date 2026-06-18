"use client"

import { useAdmin } from "@/lib/admin-store"
import type { GrowthFeatureKey } from "@/lib/growth/runtime/growth-feature-registry"
import { isGrowthFeatureShellMounted, isGrowthTier2ShellVisible } from "@/lib/growth/runtime/growth-feature-shell-guards"

export function useGrowthFeatureShellMounted(key: GrowthFeatureKey): boolean {
  const { isPlatformAdmin } = useAdmin()
  return isGrowthFeatureShellMounted(key, { isPlatformAdmin })
}

export function useGrowthTier2ShellVisible(): boolean {
  const { isPlatformAdmin } = useAdmin()
  return isGrowthTier2ShellVisible({ isPlatformAdmin })
}
