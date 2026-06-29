import { Building2 } from "lucide-react"
import { GrowthSettingsCoreLinkPage } from "@/components/growth/settings/growth-settings-core-link-page"
import { GROWTH_CORE_SETTINGS_ORGANIZATION_PATH } from "@/lib/growth/navigation/growth-workspace-core-settings-links"

export default function GrowthSettingsWorkspaceOrganizationPage() {
  return (
    <GrowthSettingsCoreLinkPage
      title="Organization"
      description="Configure workspace profile, branding, and organization details."
      icon={Building2}
      externalHref={GROWTH_CORE_SETTINGS_ORGANIZATION_PATH}
      externalLabel="Open Organization settings"
      cardDescription="Configure workspace profile, branding, and organization details."
    />
  )
}
