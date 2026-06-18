"use client"

import type { ComponentType } from "react"
import { GrowthSettingsDefaultViewsPanel } from "@/components/growth/settings/growth-settings-default-views-panel"
import { GrowthSettingsNotificationsPanel } from "@/components/growth/settings/growth-settings-notifications-panel"
import { GrowthSettingsPersonalPreferencesPanel } from "@/components/growth/settings/growth-settings-personal-preferences-panel"
import { GrowthSettingsProfilePanel } from "@/components/growth/settings/growth-settings-profile-panel"
import { GrowthSettingsSidebarPreferencesPanel } from "@/components/growth/settings/growth-settings-sidebar-preferences-panel"
import type { GrowthWorkspaceSettingsPersistedSectionId } from "@/lib/growth/settings/growth-workspace-settings-types"

export const GROWTH_SETTINGS_PERSISTED_PANELS: Record<
  GrowthWorkspaceSettingsPersistedSectionId,
  ComponentType
> = {
  profile: GrowthSettingsProfilePanel,
  notifications: GrowthSettingsNotificationsPanel,
  "personal-preferences": GrowthSettingsPersonalPreferencesPanel,
  "sidebar-preferences": GrowthSettingsSidebarPreferencesPanel,
  "default-views": GrowthSettingsDefaultViewsPanel,
}

export function GrowthSettingsPersistedPanel({
  sectionId,
}: {
  sectionId: GrowthWorkspaceSettingsPersistedSectionId
}) {
  const Panel = GROWTH_SETTINGS_PERSISTED_PANELS[sectionId]
  return <Panel />
}
