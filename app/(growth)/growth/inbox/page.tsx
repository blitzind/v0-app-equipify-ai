import { Inbox } from "lucide-react"
import { GrowthPlaceholderPage } from "@/components/growth/shell/growth-placeholder-page"

export default function GrowthInboxPlaceholderPage() {
  return (
    <GrowthPlaceholderPage
      title="Inbox"
      description="Unified inbox and reply workflows will migrate here from the admin Growth workspace."
      icon={Inbox}
      iconClassName="bg-emerald-50 text-emerald-600"
    />
  )
}
