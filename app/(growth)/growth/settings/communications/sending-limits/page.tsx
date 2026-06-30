"use client"

import { ShieldAlert } from "lucide-react"
import { GrowthReputationProtectionDashboardView } from "@/components/growth/growth-reputation-protection-dashboard"
import { GrowthCommunicationsSettingsSection } from "@/components/growth/settings/growth-communications-settings-section"

export default function GrowthCommunicationsSendingLimitsPage() {
  return (
    <GrowthCommunicationsSettingsSection
      title="Reputation"
      description="Monitor bounce, reply, and complaint signals with reputation protection and send throttles."
      icon={ShieldAlert}
      adminFallbackHref="/admin/growth/deliverability"
    >
      <GrowthReputationProtectionDashboardView />
    </GrowthCommunicationsSettingsSection>
  )
}
