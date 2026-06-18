"use client"

import { Layers } from "lucide-react"
import { GrowthMultichannelDashboardView } from "@/components/growth/growth-multichannel-dashboard"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthCampaignsPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Multi-Channel"
        description="Controlled multi-channel sequence orchestration — human tasks for calls, LinkedIn, and booking follow-ups."
        icon={Layers}
        iconClassName="bg-violet-50 text-violet-700"
      />

      <GrowthMultichannelDashboardView />
    </GrowthWorkspacePageContent>
  )
}
