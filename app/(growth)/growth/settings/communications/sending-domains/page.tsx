import { Globe } from "lucide-react"
import { GrowthSenderInfrastructureDashboard } from "@/components/growth/growth-sender-infrastructure-dashboard"
import { GrowthCommunicationsSettingsSection } from "@/components/growth/settings/growth-communications-settings-section"

export default function GrowthCommunicationsSendingDomainsPage() {
  return (
    <GrowthCommunicationsSettingsSection
      title="Sending Domains"
      description="Register sending domains and sender accounts used for outbound delivery."
      icon={Globe}
      iconClassName="bg-sky-50 text-sky-700"
      adminFallbackHref="/admin/growth/infrastructure"
    >
      <GrowthSenderInfrastructureDashboard />
    </GrowthCommunicationsSettingsSection>
  )
}
