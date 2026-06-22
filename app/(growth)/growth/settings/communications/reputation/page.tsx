import { ShieldAlert } from "lucide-react"
import { GrowthReputationProtectionDashboardView } from "@/components/growth/growth-reputation-protection-dashboard"
import { GrowthCommunicationsSettingsSection } from "@/components/growth/settings/growth-communications-settings-section"

export default function GrowthCommunicationsReputationPage() {
  return (
    <GrowthCommunicationsSettingsSection
      title="Reputation & Protection"
      description="Monitor bounce, reply, and complaint signals with reputation protection and send throttles."
      icon={ShieldAlert}
      iconClassName="bg-amber-50 text-amber-700"
      adminFallbackHref="/admin/growth/deliverability"
    >
      <GrowthReputationProtectionDashboardView />
    </GrowthCommunicationsSettingsSection>
  )
}
