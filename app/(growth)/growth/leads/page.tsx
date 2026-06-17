import { Target } from "lucide-react"
import { GrowthPlaceholderPage } from "@/components/growth/shell/growth-placeholder-page"

export default function GrowthLeadsPlaceholderPage() {
  return (
    <GrowthPlaceholderPage
      title="Leads"
      description="Lead queue, prioritization, and operator workflows will live in the dedicated Growth workspace."
      icon={Target}
      iconClassName="bg-violet-50 text-violet-600"
    />
  )
}
