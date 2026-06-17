"use client"

import type { ComponentType } from "react"
import { notFound } from "next/navigation"
import { GrowthSettingsDefaultViewsPanel } from "@/components/growth/settings/growth-settings-default-views-panel"
import { GrowthSettingsNotificationsPanel } from "@/components/growth/settings/growth-settings-notifications-panel"
import { GrowthSettingsPersonalPreferencesPanel } from "@/components/growth/settings/growth-settings-personal-preferences-panel"
import { GrowthSettingsProfilePanel } from "@/components/growth/settings/growth-settings-profile-panel"
import { GrowthSettingsSectionPlaceholder } from "@/components/growth/settings/growth-settings-section-placeholder"
import { GrowthSettingsSidebarPreferencesPanel } from "@/components/growth/settings/growth-settings-sidebar-preferences-panel"
import { getGrowthWorkspaceSettingsSectionById } from "@/lib/growth/navigation/growth-workspace-settings-navigation"
import type { GrowthWorkspaceSettingsPersistedSectionId } from "@/lib/growth/settings/growth-workspace-settings-types"
import { isGrowthWorkspaceSettingsPersistedSection } from "@/lib/growth/settings/growth-workspace-settings-types"

const PERSISTED_SECTION_PANELS: Record<GrowthWorkspaceSettingsPersistedSectionId, ComponentType> = {
  profile: GrowthSettingsProfilePanel,
  notifications: GrowthSettingsNotificationsPanel,
  "personal-preferences": GrowthSettingsPersonalPreferencesPanel,
  "sidebar-preferences": GrowthSettingsSidebarPreferencesPanel,
  "default-views": GrowthSettingsDefaultViewsPanel,
}

export function GrowthSettingsSectionPage({ sectionId }: { sectionId: string }) {
  const section = getGrowthWorkspaceSettingsSectionById(sectionId)
  if (!section) notFound()

  if (isGrowthWorkspaceSettingsPersistedSection(sectionId)) {
    const Panel = PERSISTED_SECTION_PANELS[sectionId]
    return <Panel />
  }

  return <GrowthSettingsSectionPlaceholder section={section} icon={section.icon} />
}
