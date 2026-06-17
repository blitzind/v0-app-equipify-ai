import { Phone } from "lucide-react"
import { GrowthPlaceholderPage } from "@/components/growth/shell/growth-placeholder-page"

export default function GrowthCallsPlaceholderPage() {
  return (
    <GrowthPlaceholderPage
      title="Calls"
      description="Call workspace, live coaching, and dialer surfaces will migrate here from the admin Growth workspace."
      icon={Phone}
      iconClassName="bg-sky-50 text-sky-600"
    />
  )
}
