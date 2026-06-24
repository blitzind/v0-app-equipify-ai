"use client"

import { Bot } from "lucide-react"
import { GrowthAutonomyOutboundDashboardPanel } from "@/components/growth/autonomy/growth-autonomy-outbound-dashboard-panel"
import { GrowthAutonomySettingsPanel } from "@/components/growth/settings/growth-autonomy-settings-panel"
import { GrowthCommunicationsSettingsSection } from "@/components/growth/settings/growth-communications-settings-section"

export default function GrowthAutonomySettingsPage() {
  return (
    <GrowthCommunicationsSettingsSection
      title="Growth Autonomy"
      description="Graduated autonomy levels, confidence-gated outbound send, shadow mode, budgets, and kill switches."
      icon={Bot}
    >
      <div className="space-y-6">
        <GrowthAutonomyOutboundDashboardPanel />
        <GrowthAutonomySettingsPanel />
      </div>
    </GrowthCommunicationsSettingsSection>
  )
}
