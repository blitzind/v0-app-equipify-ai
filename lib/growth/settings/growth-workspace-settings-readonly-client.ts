/** Phase 8B.1 — non-blocking read-only settings fetch helpers (client-safe). */

import {
  DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES,
  type GrowthWorkspaceSettingsDefaultViews,
  type GrowthWorkspaceSettingsPersonalPreferences,
  type GrowthWorkspaceSettingsSidebarPreferences,
} from "@/lib/growth/settings/growth-workspace-settings-types"
import { mergeGrowthWorkspaceDefaultViews } from "@/lib/growth/settings/growth-workspace-settings-consumption"

type ApiOk<T> = { ok?: boolean; preferences?: T; message?: string }

type GrowthWorkspaceSettingsReadonlyBootstrap = {
  defaultViews: GrowthWorkspaceSettingsDefaultViews
  personal: GrowthWorkspaceSettingsPersonalPreferences
  sidebar: GrowthWorkspaceSettingsSidebarPreferences
}

let settingsBootstrapInflight: Promise<GrowthWorkspaceSettingsReadonlyBootstrap> | null = null

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
    const res = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(8_000) })
    const data = (await res.json().catch(() => ({}))) as ApiOk<T>
    if (!res.ok || !data.ok || !data.preferences) return null
    return data.preferences
  } catch {
    return null
  }
}

async function loadGrowthWorkspaceSettingsReadonlyBootstrap(): Promise<GrowthWorkspaceSettingsReadonlyBootstrap> {
  if (!settingsBootstrapInflight) {
    settingsBootstrapInflight = Promise.all([
      fetchJson<GrowthWorkspaceSettingsDefaultViews>("/api/growth/workspace/settings/default-views"),
      fetchJson<GrowthWorkspaceSettingsPersonalPreferences>("/api/growth/workspace/settings/personal-preferences"),
      fetchJson<GrowthWorkspaceSettingsSidebarPreferences>("/api/growth/workspace/settings/sidebar-preferences"),
    ]).then(([defaultViews, personal, sidebar]) => ({
      defaultViews: mergeGrowthWorkspaceDefaultViews(defaultViews),
      personal: personal ?? DEFAULT_PERSONAL,
      sidebar: sidebar ?? DEFAULT_SIDEBAR,
    }))
  }
  return settingsBootstrapInflight
}

export async function loadGrowthWorkspaceDefaultViewsReadonly(): Promise<GrowthWorkspaceSettingsDefaultViews> {
  const bootstrap = await loadGrowthWorkspaceSettingsReadonlyBootstrap()
  return bootstrap.defaultViews
}

export async function loadGrowthWorkspaceShellPreferencesReadonly(): Promise<{
  personal: GrowthWorkspaceSettingsPersonalPreferences
  sidebar: GrowthWorkspaceSettingsSidebarPreferences
}> {
  const bootstrap = await loadGrowthWorkspaceSettingsReadonlyBootstrap()
  return {
    personal: bootstrap.personal,
    sidebar: bootstrap.sidebar,
  }
}

/** Test-only reset for module-level fetch dedupe caches. */
export function resetGrowthWorkspaceSettingsReadonlyClientForTests(): void {
  settingsBootstrapInflight = null
}
