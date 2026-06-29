import { Users } from "lucide-react"
import { GrowthSettingsCoreLinkPage } from "@/components/growth/settings/growth-settings-core-link-page"
import { GROWTH_CORE_SETTINGS_TEAM_PATH } from "@/lib/growth/navigation/growth-workspace-core-settings-links"

export default function GrowthSettingsWorkspaceTeamPage() {
  return (
    <GrowthSettingsCoreLinkPage
      title="Team"
      description="Manage users, invites, roles, and permissions for your workspace."
      icon={Users}
      externalHref={GROWTH_CORE_SETTINGS_TEAM_PATH}
      externalLabel="Open Team settings"
      cardDescription="Manage users, invites, roles, and permissions."
    />
  )
}
