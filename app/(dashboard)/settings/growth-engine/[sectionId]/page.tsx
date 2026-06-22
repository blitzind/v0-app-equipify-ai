import { notFound, redirect } from "next/navigation"
import { WorkspaceSettingsGrowthEngineSectionPage } from "@/components/settings/workspace-settings-growth-engine-section-page"
import { resolveGrowthEngineSettingsCanonicalRedirect } from "@/lib/growth/navigation/growth-workspace-settings-canonical"
import { getWorkspaceSettingsGrowthEngineSection } from "@/lib/settings/workspace-settings-navigation"

type PageProps = {
  params: Promise<{ sectionId: string }>
}

export default async function GrowthEngineSettingsSectionPage({ params }: PageProps) {
  const { sectionId } = await params
  if (!getWorkspaceSettingsGrowthEngineSection(sectionId)) notFound()

  const canonicalHref = resolveGrowthEngineSettingsCanonicalRedirect(sectionId)
  if (canonicalHref) redirect(canonicalHref)

  return <WorkspaceSettingsGrowthEngineSectionPage sectionId={sectionId} />
}
