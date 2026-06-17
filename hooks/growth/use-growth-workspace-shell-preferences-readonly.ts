"use client"

import { useEffect, useState } from "react"
import { loadGrowthWorkspaceShellPreferencesReadonly } from "@/lib/growth/settings/growth-workspace-settings-readonly-client"
import {
  DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES,
  type GrowthWorkspaceSettingsPersonalPreferences,
  type GrowthWorkspaceSettingsSidebarPreferences,
} from "@/lib/growth/settings/growth-workspace-settings-types"

export function useGrowthWorkspaceShellPreferencesReadonly(): {
  personal: GrowthWorkspaceSettingsPersonalPreferences
  sidebar: GrowthWorkspaceSettingsSidebarPreferences
  loaded: boolean
  failed: boolean
} {
  const [personal, setPersonal] = useState<GrowthWorkspaceSettingsPersonalPreferences>({
    defaultLandingPage: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.defaultLandingPage,
    compactMode: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.compactMode,
    reducedMotion: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.reducedMotion,
  })
  const [sidebar, setSidebar] = useState<GrowthWorkspaceSettingsSidebarPreferences>({
    sidebarCollapsed: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.sidebarCollapsed,
    favoriteDestinations: [],
    lastVisitedRoute: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.lastVisitedRoute,
  })
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadGrowthWorkspaceShellPreferencesReadonly()
      .then((preferences) => {
        if (cancelled) return
        setPersonal(preferences.personal)
        setSidebar(preferences.sidebar)
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

  return { personal, sidebar, loaded, failed }
}
