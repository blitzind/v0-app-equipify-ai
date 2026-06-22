import { Users } from "lucide-react"
import { GrowthSenderPoolsDashboardView } from "@/components/growth/growth-sender-pools-dashboard"
import { GrowthCommunicationsSettingsSection } from "@/components/growth/settings/growth-communications-settings-section"

export default function GrowthCommunicationsSenderPoolsPage() {
  return (
    <GrowthCommunicationsSettingsSection
      title="Sender Pools"
      description="Configure rotation pools, member eligibility, and operational pause rules."
      icon={Users}
      iconClassName="bg-indigo-50 text-indigo-700"
      adminFallbackHref="/admin/growth/providers/sender-pools"
    >
      <GrowthSenderPoolsDashboardView />
    </GrowthCommunicationsSettingsSection>
  )
}
