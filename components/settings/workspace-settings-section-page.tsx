"use client"

import { notFound } from "next/navigation"
import { WorkspaceSettingsPhasePlaceholder } from "@/components/settings/workspace-settings-phase-placeholder"
import { resolveWorkspaceSettingsDataAdminPlaceholderCopy } from "@/lib/settings/workspace-settings-data-admin-placeholder"
import { getWorkspaceSettingsDataAdminSection } from "@/lib/settings/workspace-settings-navigation"

type WorkspaceSettingsSectionPageProps = {
  sectionId: string
}

export function WorkspaceSettingsSectionPage({ sectionId }: WorkspaceSettingsSectionPageProps) {
  const section = getWorkspaceSettingsDataAdminSection(sectionId)
  if (!section) notFound()
  const placeholderCopy = resolveWorkspaceSettingsDataAdminPlaceholderCopy(sectionId)
  return (
    <WorkspaceSettingsPhasePlaceholder
      section={section}
      icon={section.icon}
      variant="admin"
      adminTitle={placeholderCopy.title}
      adminDescription={placeholderCopy.description}
    />
  )
}
