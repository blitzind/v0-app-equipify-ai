"use client"

import { GrowthOpportunityWorkspaceDashboard } from "@/components/growth/growth-opportunity-workspace-dashboard"
import { GrowthOperatorExecutionWorkspaceV2Section } from "@/components/growth/growth-operator-execution-workspace-v2"

export function GrowthOpportunitiesOperatorDashboardBody() {
  return (
    <>
      <GrowthOperatorExecutionWorkspaceV2Section />
      <GrowthOpportunityWorkspaceDashboard />
    </>
  )
}
