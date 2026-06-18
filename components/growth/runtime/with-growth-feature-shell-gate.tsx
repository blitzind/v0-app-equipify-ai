"use client"

import type { ComponentType } from "react"
import type { GrowthFeatureKey } from "@/lib/growth/runtime/growth-feature-registry"
import { useGrowthFeatureShellMounted } from "@/lib/growth/runtime/use-growth-feature-shell-mounted"

/** Prevents Tier 2 panel hooks/effects when cold storage is active. */
export function withGrowthFeatureShellGate<P extends object>(
  feature: GrowthFeatureKey,
  Inner: ComponentType<P>,
  displayName?: string,
): ComponentType<P> {
  function GatedPanel(props: P) {
    const mounted = useGrowthFeatureShellMounted(feature)
    if (!mounted) return null
    return <Inner {...props} />
  }
  GatedPanel.displayName = displayName ?? `GrowthFeatureShellGate(${feature})`
  return GatedPanel
}
