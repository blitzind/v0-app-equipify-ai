import { Workflow } from "lucide-react"
import { GrowthPlaceholderPage } from "@/components/growth/shell/growth-placeholder-page"

export default function GrowthCampaignsPlaceholderPage() {
  return (
    <GrowthPlaceholderPage
      title="Campaigns"
      description="Sequence and campaign orchestration will migrate here from the admin Growth workspace."
      icon={Workflow}
      iconClassName="bg-sky-50 text-sky-600"
    />
  )
}
