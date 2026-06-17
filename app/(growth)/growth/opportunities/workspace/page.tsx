"use client"

import { Target } from "lucide-react"
import { GrowthOpportunitiesOperatorWorkspace } from "@/components/growth/opportunities/growth-opportunities-operator-workspace"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthOpportunitiesWorkspacePage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Opportunity Workspace"
        description="Evidence-backed opportunity signals, buying momentum, committee intelligence, and operator recommendations — no autonomous deal progression."
        icon={Target}
        iconClassName="bg-violet-50 text-violet-600"
      />

      <GrowthOpportunitiesOperatorWorkspace showPageHeader={false} />
    </div>
  )
}
