"use client"

import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { GrowthAvaAboutDashboard } from "@/components/growth/ava-about/growth-ava-about-dashboard"
import { useGrowthAvaAboutData } from "@/components/growth/ava-about/use-growth-ava-about-data"
import { useGrowthWorkspaceDashboard } from "@/components/growth/workspace/use-growth-workspace-dashboard"
import { useAdmin } from "@/lib/admin-store"

export default function GrowthAvaAboutPage() {
  const { dashboard, workspaceSummary } = useGrowthWorkspaceDashboard()
  const { sessionIdentity } = useAdmin()
  const { loading, model, teammate } = useGrowthAvaAboutData({
    dashboard,
    workspaceSummary,
    operatorDisplayName: sessionIdentity?.displayName ?? null,
  })

  return (
    <GrowthWorkspacePageContent>
      <GrowthAvaAboutDashboard loading={loading} model={model} teammate={teammate} />
    </GrowthWorkspacePageContent>
  )
}
