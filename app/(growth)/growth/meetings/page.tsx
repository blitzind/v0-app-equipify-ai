import { Users } from "lucide-react"
import { GrowthPlaceholderPage } from "@/components/growth/shell/growth-placeholder-page"

export default function GrowthMeetingsPlaceholderPage() {
  return (
    <GrowthPlaceholderPage
      title="Meetings"
      description="Meeting intelligence and booking handoff views will migrate here from the admin Growth workspace."
      icon={Users}
      iconClassName="bg-violet-50 text-violet-600"
    />
  )
}
