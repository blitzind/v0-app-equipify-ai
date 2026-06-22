import { notFound } from "next/navigation"
import { WorkspaceSettingsGrowthEngineSectionPage } from "@/components/settings/workspace-settings-growth-engine-section-page"
import { getWorkspaceSettingsGrowthEngineSection } from "@/lib/settings/workspace-settings-navigation"

type PageProps = {
  params: Promise<{ sectionId: string }>
}

export default async function GrowthEngineSettingsSectionPage({ params }: PageProps) {
  const { sectionId } = await params
  if (!getWorkspaceSettingsGrowthEngineSection(sectionId)) notFound()

  return <WorkspaceSettingsGrowthEngineSectionPage sectionId={sectionId} />
}
