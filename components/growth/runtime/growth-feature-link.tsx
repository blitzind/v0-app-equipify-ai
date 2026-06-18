"use client"

import type { ComponentProps } from "react"
import Link from "next/link"
import { useAdmin } from "@/lib/admin-store"
import type { GrowthFeatureKey } from "@/lib/growth/runtime/growth-feature-registry"
import {
  isGrowthFeatureShellMounted,
  shouldDisableGrowthFeatureRoutePrefetch,
} from "@/lib/growth/runtime/growth-feature-shell-guards"

type GrowthFeatureLinkProps = ComponentProps<typeof Link> & {
  feature?: GrowthFeatureKey
  href: string
}

/**
 * Growth navigation link — hides cold Tier 2 targets and disables prefetch in operator_minimal.
 */
export function GrowthFeatureLink({ feature, href, prefetch, ...props }: GrowthFeatureLinkProps) {
  const { isPlatformAdmin } = useAdmin()
  const context = { isPlatformAdmin }

  if (feature && !isGrowthFeatureShellMounted(feature, context)) {
    return null
  }

  const coldPrefetch = shouldDisableGrowthFeatureRoutePrefetch(href, context)
  const resolvedPrefetch = prefetch ?? (coldPrefetch ? false : undefined)

  return <Link href={href} prefetch={resolvedPrefetch} {...props} />
}
