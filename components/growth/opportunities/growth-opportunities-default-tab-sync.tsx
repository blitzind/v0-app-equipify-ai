"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useGrowthWorkspaceDefaultViewsReadonly } from "@/hooks/growth/use-growth-workspace-default-views-readonly"
import {
  resolveGrowthOpportunitiesDefaultTabHref,
  shouldApplyGrowthOpportunitiesSavedDefaultTab,
} from "@/lib/growth/settings/growth-workspace-settings-consumption"

/** Route overview visitors to a saved default tab when explicit tab routes are not used. */
export function GrowthOpportunitiesDefaultTabSync() {
  const pathname = usePathname()
  const router = useRouter()
  const { defaultViews, loaded } = useGrowthWorkspaceDefaultViewsReadonly()
  const appliedRef = useRef(false)

  useEffect(() => {
    if (!loaded || appliedRef.current) return
    if (!shouldApplyGrowthOpportunitiesSavedDefaultTab(pathname)) return

    const href = resolveGrowthOpportunitiesDefaultTabHref(defaultViews.opportunitiesDefaultTab)
    appliedRef.current = true
    if (!href) return

    router.replace(href)
  }, [defaultViews.opportunitiesDefaultTab, loaded, pathname, router])

  return null
}
