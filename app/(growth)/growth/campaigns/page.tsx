"use client"

import { Layers } from "lucide-react"
import { GrowthMultichannelDashboardView } from "@/components/growth/growth-multichannel-dashboard"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthCampaignsPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Multi-Channel"
        description="Controlled multi-channel sequence orchestration — human tasks for calls, LinkedIn, and booking follow-ups."
        icon={Layers}
        iconClassName="bg-violet-50 text-violet-700"
      />

      <GrowthMultichannelDashboardView />
    </div>
  )
}
