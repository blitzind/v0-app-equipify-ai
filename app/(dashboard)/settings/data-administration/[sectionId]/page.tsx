import { WorkspaceSettingsSectionPage } from "@/components/settings/workspace-settings-section-page"

type PageProps = {
  params: Promise<{ sectionId: string }>
}

export default async function DataAdministrationSettingsSectionPage({ params }: PageProps) {
  const { sectionId } = await params
  return <WorkspaceSettingsSectionPage sectionId={sectionId} />
}
