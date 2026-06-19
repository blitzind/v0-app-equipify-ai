"use client"

import { Layers } from "lucide-react"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { GrowthCampaignsHubTodaysBriefing } from "@/components/growth/hubs/campaigns/growth-campaigns-hub-todays-briefing"
import { GrowthCampaignsHubOperatorHealth } from "@/components/growth/hubs/campaigns/growth-campaigns-hub-operator-health"
import { GrowthCampaignsHubMyTasks } from "@/components/growth/hubs/campaigns/growth-campaigns-hub-my-tasks"
import { GrowthCampaignsHubRecommendations } from "@/components/growth/hubs/campaigns/growth-campaigns-hub-recommendations"
import { GrowthCampaignsHubPerformance } from "@/components/growth/hubs/campaigns/growth-campaigns-hub-performance"
import { GrowthCampaignsHubActiveCampaigns } from "@/components/growth/hubs/campaigns/growth-campaigns-hub-active-campaigns"
import { GrowthCampaignsHubRecentEvents } from "@/components/growth/hubs/campaigns/growth-campaigns-hub-recent-events"
import { GrowthCampaignsHubAdvancedSettings } from "@/components/growth/hubs/campaigns/growth-campaigns-hub-advanced-settings"
import { GrowthCampaignsHubHeaderActions } from "@/components/growth/hubs/campaigns/growth-campaigns-hub-header-actions"
import { GROWTH_CAMPAIGNS_HUB_UX_QA_MARKER } from "@/lib/growth/hubs/growth-campaigns-hub-config"
import { GROWTH_WORKSPACE_HUB_QA_MARKER } from "@/lib/growth/hubs/growth-workspace-hub-types"

export function GrowthCampaignsHubPage() {
  return (
    <GrowthWorkspacePageContent
      data-qa-marker={GROWTH_WORKSPACE_HUB_QA_MARKER}
      data-growth-campaigns-hub-ux={GROWTH_CAMPAIGNS_HUB_UX_QA_MARKER}
      data-growth-workspace-hub="campaigns"
    >
      <GrowthWorkspacePageHeader
        title="Campaigns"
        description="Daily campaign operations — sequence execution, booking follow-ups, and channel health."
        icon={Layers}
        iconClassName="bg-violet-50 text-violet-700"
        actions={<GrowthCampaignsHubHeaderActions />}
      />

      <div className="space-y-5">
        <GrowthCampaignsHubTodaysBriefing />
        <GrowthCampaignsHubOperatorHealth />
        <GrowthCampaignsHubMyTasks />
        <GrowthCampaignsHubRecommendations />
        <GrowthCampaignsHubPerformance />
        <GrowthCampaignsHubActiveCampaigns />
        <GrowthCampaignsHubRecentEvents />
        <GrowthCampaignsHubAdvancedSettings />
      </div>
    </GrowthWorkspacePageContent>
  )
}
