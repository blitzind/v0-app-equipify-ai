import { redirect } from "next/navigation"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import { getGrowthWorkspaceSettingsSectionById } from "@/lib/growth/navigation/growth-workspace-settings-navigation"
import { getWorkspaceSettingsGrowthOperatorSection } from "@/lib/settings/workspace-settings-growth-operator"

type PageProps = {
  params: Promise<{ sectionId: string }>
}

export default async function GrowthOperatorSettingsSectionRedirectPage({ params }: PageProps) {
  const { sectionId } = await params
  const growthSection = getGrowthWorkspaceSettingsSectionById(sectionId)
  if (growthSection) redirect(growthSection.href)

  if (!getWorkspaceSettingsGrowthOperatorSection(sectionId)) redirect(`${GROWTH_WORKSPACE_BASE_PATH}/settings`)

  redirect(`${GROWTH_WORKSPACE_BASE_PATH}/settings/${sectionId}`)
}
