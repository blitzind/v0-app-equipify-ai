"use client"

import { notFound } from "next/navigation"
import { WorkspaceSettingsPhasePlaceholder } from "@/components/settings/workspace-settings-phase-placeholder"
import type { WorkspaceSettingsNavItem } from "@/lib/settings/workspace-settings-navigation"

type WorkspaceSettingsSectionPageProps = {
  section: WorkspaceSettingsNavItem | null
}

export function WorkspaceSettingsSectionPage({ section }: WorkspaceSettingsSectionPageProps) {
  if (!section) notFound()
  return <WorkspaceSettingsPhasePlaceholder section={section} icon={section.icon} />
}
