"use client"

import { notFound } from "next/navigation"
import { GrowthSettingsPersistedPanel } from "@/components/growth/settings/growth-settings-persisted-panels"
import { GrowthSettingsSectionPlaceholder } from "@/components/growth/settings/growth-settings-section-placeholder"
import { getGrowthWorkspaceSettingsSectionById } from "@/lib/growth/navigation/growth-workspace-settings-navigation"
import { isGrowthWorkspaceSettingsPersistedSection } from "@/lib/growth/settings/growth-workspace-settings-types"

export function GrowthSettingsSectionPage({ sectionId }: { sectionId: string }) {
  const section = getGrowthWorkspaceSettingsSectionById(sectionId)
  if (!section) notFound()

  if (isGrowthWorkspaceSettingsPersistedSection(sectionId)) {
    return <GrowthSettingsPersistedPanel sectionId={sectionId} />
  }

  return <GrowthSettingsSectionPlaceholder section={section} icon={section.icon} />
}
