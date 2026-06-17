"use client"

import { Target } from "lucide-react"
import { GrowthOpportunitiesReadinessWorkspace } from "@/components/growth/opportunities/growth-opportunities-readiness-workspace"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthOpportunitiesPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Opportunity Readiness"
        description="Sales-motion readiness scoring with blockers, accelerators, and executive close candidates — read-only intelligence, no send."
        icon={Target}
        iconClassName="bg-violet-50 text-violet-600"
      />

      <GrowthOpportunitiesReadinessWorkspace showPageHeader={false} />
    </div>
  )
}
