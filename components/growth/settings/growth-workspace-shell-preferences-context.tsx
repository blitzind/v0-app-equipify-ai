"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useGrowthWorkspaceShellPreferencesReadonly } from "@/hooks/growth/use-growth-workspace-shell-preferences-readonly"
import {
  DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES,
  type GrowthWorkspaceSettingsPersonalPreferences,
  type GrowthWorkspaceSettingsSidebarPreferences,
} from "@/lib/growth/settings/growth-workspace-settings-types"

type GrowthWorkspaceShellPreferencesContextValue = {
  personal: GrowthWorkspaceSettingsPersonalPreferences
  sidebar: GrowthWorkspaceSettingsSidebarPreferences
  loaded: boolean
  failed: boolean
}

const GrowthWorkspaceShellPreferencesContext =
  createContext<GrowthWorkspaceShellPreferencesContextValue | null>(null)

export function GrowthWorkspaceShellPreferencesProvider({ children }: { children: ReactNode }) {
  const { personal, sidebar, loaded, failed } = useGrowthWorkspaceShellPreferencesReadonly()
  const value = useMemo(
    () => ({
      personal,
      sidebar,
      loaded,
      failed,
    }),
    [personal, sidebar, loaded, failed],
  )

  return (
    <GrowthWorkspaceShellPreferencesContext.Provider value={value}>
      {children}
    </GrowthWorkspaceShellPreferencesContext.Provider>
  )
}

export function useGrowthWorkspaceShellPreferences(): GrowthWorkspaceShellPreferencesContextValue {
  const value = useContext(GrowthWorkspaceShellPreferencesContext)
  if (!value) {
    return {
      personal: {
        defaultLandingPage: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.defaultLandingPage,
        compactMode: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.compactMode,
        reducedMotion: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.reducedMotion,
      },
      sidebar: {
        sidebarCollapsed: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.sidebarCollapsed,
        favoriteDestinations: [],
        lastVisitedRoute: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.lastVisitedRoute,
      },
      loaded: false,
      failed: false,
    }
  }
  return value
}
