import { Plug } from "lucide-react"
import { GrowthSettingsCoreLinkPage } from "@/components/growth/settings/growth-settings-core-link-page"
import { GROWTH_CORE_SETTINGS_INTEGRATIONS_PATH } from "@/lib/growth/navigation/growth-workspace-core-settings-links"

export default function GrowthSettingsWorkspaceIntegrationsPage() {
  return (
    <GrowthSettingsCoreLinkPage
      title="Integrations"
      description="Connect and manage third-party services and platform integrations."
      icon={Plug}
      iconClassName="bg-amber-50 text-amber-800"
      externalHref={GROWTH_CORE_SETTINGS_INTEGRATIONS_PATH}
      externalLabel="Open Integrations settings"
      cardDescription="Connect and manage third-party services and platform integrations."
    />
  )
}
