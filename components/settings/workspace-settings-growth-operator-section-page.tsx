"use client"

import { notFound } from "next/navigation"
import { GrowthSettingsPersistedPanel } from "@/components/growth/settings/growth-settings-persisted-panels"
import { getWorkspaceSettingsGrowthOperatorSection } from "@/lib/settings/workspace-settings-growth-operator"
import { isGrowthWorkspaceSettingsPersistedSection } from "@/lib/growth/settings/growth-workspace-settings-types"

export function WorkspaceSettingsGrowthOperatorSectionPage({ sectionId }: { sectionId: string }) {
  const section = getWorkspaceSettingsGrowthOperatorSection(sectionId)
  if (!section || !isGrowthWorkspaceSettingsPersistedSection(sectionId)) notFound()
  return <GrowthSettingsPersistedPanel sectionId={sectionId} />
}
