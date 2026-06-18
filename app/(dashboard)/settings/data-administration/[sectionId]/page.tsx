import { WorkspaceSettingsSectionPage } from "@/components/settings/workspace-settings-section-page"
import { getWorkspaceSettingsDataAdminSection } from "@/lib/settings/workspace-settings-navigation"

type PageProps = {
  params: Promise<{ sectionId: string }>
}

export default async function DataAdministrationSettingsSectionPage({ params }: PageProps) {
  const { sectionId } = await params
  const section = getWorkspaceSettingsDataAdminSection(sectionId)
  return <WorkspaceSettingsSectionPage section={section} />
}
