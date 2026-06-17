/** Phase 8B.1 — non-blocking read-only settings fetch helpers (client-safe). */

import {
  DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES,
  type GrowthWorkspaceSettingsDefaultViews,
  type GrowthWorkspaceSettingsPersonalPreferences,
  type GrowthWorkspaceSettingsSidebarPreferences,
} from "@/lib/growth/settings/growth-workspace-settings-types"
import { mergeGrowthWorkspaceDefaultViews } from "@/lib/growth/settings/growth-workspace-settings-consumption"

type ApiOk<T> = { ok?: boolean; preferences?: T; message?: string }

let defaultViewsInflight: Promise<GrowthWorkspaceSettingsDefaultViews> | null = null
let shellPreferencesInflight: Promise<{
  personal: GrowthWorkspaceSettingsPersonalPreferences
  sidebar: GrowthWorkspaceSettingsSidebarPreferences
}> | null = null

const DEFAULT_PERSONAL: GrowthWorkspaceSettingsPersonalPreferences = {
  defaultLandingPage: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.defaultLandingPage,
  compactMode: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.compactMode,
  reducedMotion: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.reducedMotion,
}

const DEFAULT_SIDEBAR: GrowthWorkspaceSettingsSidebarPreferences = {
  sidebarCollapsed: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.sidebarCollapsed,
  favoriteDestinations: [],
  lastVisitedRoute: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.lastVisitedRoute,
}

async function fetchJson<T>(endpoint: string): Promise<T | null> {
  try {
    const res = await fetch(endpoint, { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as ApiOk<T>
    if (!res.ok || !data.ok || !data.preferences) return null
    return data.preferences
  } catch {
    return null
  }
}

export async function loadGrowthWorkspaceDefaultViewsReadonly(): Promise<GrowthWorkspaceSettingsDefaultViews> {
  if (!defaultViewsInflight) {
    defaultViewsInflight = fetchJson<GrowthWorkspaceSettingsDefaultViews>(
      "/api/growth/workspace/settings/default-views",
    ).then((preferences) => mergeGrowthWorkspaceDefaultViews(preferences))
  }
  return defaultViewsInflight
}

export async function loadGrowthWorkspaceShellPreferencesReadonly(): Promise<{
  personal: GrowthWorkspaceSettingsPersonalPreferences
  sidebar: GrowthWorkspaceSettingsSidebarPreferences
}> {
  if (!shellPreferencesInflight) {
    shellPreferencesInflight = Promise.all([
      fetchJson<GrowthWorkspaceSettingsPersonalPreferences>(
        "/api/growth/workspace/settings/personal-preferences",
      ),
      fetchJson<GrowthWorkspaceSettingsSidebarPreferences>(
        "/api/growth/workspace/settings/sidebar-preferences",
      ),
    ]).then(([personal, sidebar]) => ({
      personal: personal ?? DEFAULT_PERSONAL,
      sidebar: sidebar ?? DEFAULT_SIDEBAR,
    }))
  }
  return shellPreferencesInflight
}

/** Test-only reset for module-level fetch dedupe caches. */
export function resetGrowthWorkspaceSettingsReadonlyClientForTests(): void {
  defaultViewsInflight = null
  shellPreferencesInflight = null
}
