import { redirect } from "next/navigation"
import { growthEngineCustomerSettingsHref } from "@/lib/growth/navigation/growth-workspace-settings-canonical"
import { getWorkspaceSettingsGrowthEngineSection } from "@/lib/settings/workspace-settings-navigation"

type PageProps = {
  params: Promise<{ sectionId: string }>
}

export default async function GrowthEngineSettingsSectionRedirectPage({ params }: PageProps) {
  const { sectionId } = await params
  if (!getWorkspaceSettingsGrowthEngineSection(sectionId)) redirect("/growth/settings")

  redirect(growthEngineCustomerSettingsHref(sectionId))
}
