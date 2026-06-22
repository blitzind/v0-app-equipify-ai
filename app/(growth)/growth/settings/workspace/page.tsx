import { Building2 } from "lucide-react"
import { GrowthSettingsCoreLinkHub } from "@/components/growth/settings/growth-settings-core-link-page"
import { GROWTH_CORE_SETTINGS_LINK_CARDS } from "@/lib/growth/navigation/growth-workspace-core-settings-links"

export default function GrowthSettingsWorkspaceHubPage() {
  return (
    <GrowthSettingsCoreLinkHub
      title="Workspace"
      description="Team, organization, billing, and integrations use your existing workspace settings — open any card for a direct link."
      icon={Building2}
      iconClassName="bg-blue-50 text-blue-700"
      cards={GROWTH_CORE_SETTINGS_LINK_CARDS}
    />
  )
}
