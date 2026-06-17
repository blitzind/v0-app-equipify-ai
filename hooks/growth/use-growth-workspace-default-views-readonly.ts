"use client"

import { useEffect, useState } from "react"
import { mergeGrowthWorkspaceDefaultViews } from "@/lib/growth/settings/growth-workspace-settings-consumption"
import { loadGrowthWorkspaceDefaultViewsReadonly } from "@/lib/growth/settings/growth-workspace-settings-readonly-client"
import type { GrowthWorkspaceSettingsDefaultViews } from "@/lib/growth/settings/growth-workspace-settings-types"

export function useGrowthWorkspaceDefaultViewsReadonly(): {
  defaultViews: GrowthWorkspaceSettingsDefaultViews
  loaded: boolean
  failed: boolean
} {
  const [defaultViews, setDefaultViews] = useState<GrowthWorkspaceSettingsDefaultViews>(() =>
    mergeGrowthWorkspaceDefaultViews(null),
  )
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadGrowthWorkspaceDefaultViewsReadonly()
      .then((preferences) => {
        if (cancelled) return
        setDefaultViews(preferences)
        setFailed(false)
      })
      .catch(() => {
        if (cancelled) return
        setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { defaultViews, loaded, failed }
}
