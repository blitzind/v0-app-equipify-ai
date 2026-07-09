"use client"

import { GrowthTrainingOverviewSection } from "@/components/growth/training/growth-training-overview-section"
import { useGrowthTrainingOverviewData } from "@/components/growth/training/use-growth-training-overview-data"
import { useGrowthWorkspaceDashboard } from "@/components/growth/workspace/use-growth-workspace-dashboard"

export default function GrowthTrainingOverviewPage() {
  const { workspaceSummary, loading: dashboardLoading, dashboard } = useGrowthWorkspaceDashboard()
  const overview = useGrowthTrainingOverviewData({
    dashboard,
    organizationalKnowledge: workspaceSummary?.organizationalKnowledge ?? null,
  })

  return (
    <GrowthTrainingOverviewSection
      loading={dashboardLoading || overview.loading}
      activeApproved={overview.activeApproved}
      latestDraft={overview.latestDraft}
      organizationalKnowledge={overview.organizationalKnowledge}
      launchSetup={overview.launchSetup}
    />
  )
}
