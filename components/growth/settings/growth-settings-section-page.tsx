"use client"

import { notFound } from "next/navigation"
import { GrowthSettingsSectionPlaceholder } from "@/components/growth/settings/growth-settings-section-placeholder"
import { getGrowthWorkspaceSettingsSectionById } from "@/lib/growth/navigation/growth-workspace-settings-navigation"

export function GrowthSettingsSectionPage({ sectionId }: { sectionId: string }) {
  const section = getGrowthWorkspaceSettingsSectionById(sectionId)
  if (!section) notFound()

  return <GrowthSettingsSectionPlaceholder section={section} icon={section.icon} />
}
