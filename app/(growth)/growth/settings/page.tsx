import { Settings } from "lucide-react"
import { GrowthPlaceholderPage } from "@/components/growth/shell/growth-placeholder-page"

export default function GrowthSettingsPlaceholderPage() {
  return (
    <GrowthPlaceholderPage
      title="Settings"
      description="Growth Engine providers, team, and compliance settings will consolidate here in a future phase."
      icon={Settings}
      iconClassName="bg-slate-100 text-slate-600"
    />
  )
}
