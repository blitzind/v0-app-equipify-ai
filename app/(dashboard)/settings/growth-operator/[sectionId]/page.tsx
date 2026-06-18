import { WorkspaceSettingsGrowthOperatorSectionPage } from "@/components/settings/workspace-settings-growth-operator-section-page"

type PageProps = {
  params: Promise<{ sectionId: string }>
}

export default async function GrowthOperatorSettingsSectionPage({ params }: PageProps) {
  const { sectionId } = await params
  return <WorkspaceSettingsGrowthOperatorSectionPage sectionId={sectionId} />
}
