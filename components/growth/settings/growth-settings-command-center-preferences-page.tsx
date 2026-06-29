"use client"

import { GrowthSettingsSidebarPreferencesPanel } from "@/components/growth/settings/growth-settings-sidebar-preferences-panel"

export const GROWTH_SETTINGS_COMMAND_CENTER_PREFERENCES_PAGE_QA_MARKER =
  "growth-settings-command-center-preferences-ia-1b-v1" as const

export function GrowthSettingsCommandCenterPreferencesPage() {
  return (
    <div data-qa-marker={GROWTH_SETTINGS_COMMAND_CENTER_PREFERENCES_PAGE_QA_MARKER}>
      <GrowthSettingsSidebarPreferencesPanel variant="command-center" />
    </div>
  )
}
