import { GrowthAutonomySettingsPanel } from "@/components/growth/settings/growth-autonomy-settings-panel"
import { GrowthCommunicationsSettingsSection } from "@/components/growth/settings/growth-communications-settings-section"
import { Bot } from "lucide-react"

export default function GrowthAutonomySettingsPage() {
  return (
    <GrowthCommunicationsSettingsSection
      title="Growth Autonomy"
      description="Graduated autonomy levels, capability toggles, budgets, and kill switches. Outbound remains human-controlled."
      icon={Bot}
    >
      <GrowthAutonomySettingsPanel />
    </GrowthCommunicationsSettingsSection>
  )
}
