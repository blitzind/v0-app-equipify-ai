"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useGrowthWorkspaceDefaultViewsReadonly } from "@/hooks/growth/use-growth-workspace-default-views-readonly"
import {
  resolveGrowthCallsDefaultViewDestination,
  shouldApplyGrowthCallsSavedDefault,
} from "@/lib/growth/settings/growth-workspace-settings-consumption"

/** Navigate to saved external calls destinations (queue, live, coaching) when no explicit view exists. */
export function GrowthCallsDefaultViewSync() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { defaultViews, loaded } = useGrowthWorkspaceDefaultViewsReadonly()
  const appliedRef = useRef(false)

  useEffect(() => {
    const viewParam = searchParams.get("view")

    if (!loaded || appliedRef.current) return
    if (!shouldApplyGrowthCallsSavedDefault({ pathname, viewParam })) return

    const destination = resolveGrowthCallsDefaultViewDestination(defaultViews.callsDefaultView)
    appliedRef.current = true

    if (destination.kind === "navigate") {
      router.replace(destination.href)
    }
  }, [defaultViews.callsDefaultView, loaded, pathname, router, searchParams])

  return null
}
