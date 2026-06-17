"use client"

import { GitBranch } from "lucide-react"
import { GrowthOpportunitiesPipelineWorkspace } from "@/components/growth/opportunities/growth-opportunities-pipeline-workspace"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthOpportunitiesPipelinePage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Opportunity Pipeline"
        description="Deal operating system — pipeline stages, forecast categories, weighted revenue, and human-controlled close workflows."
        icon={GitBranch}
        iconClassName="bg-emerald-50 text-emerald-700"
      />

      <GrowthOpportunitiesPipelineWorkspace showPageHeader={false} />
    </div>
  )
}
