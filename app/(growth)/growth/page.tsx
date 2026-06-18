"use client"

import { LayoutDashboard } from "lucide-react"
import { GrowthWorkspaceDashboardBody } from "@/components/growth/workspace/growth-workspace-dashboard-body"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthWorkspaceDashboardPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Operator Home"
        description="Daily queue, activity, pipeline, campaigns, and intelligence — your Growth workspace starting point."
        icon={LayoutDashboard}
        iconClassName="bg-violet-50 text-violet-600"
      />

      <GrowthWorkspaceDashboardBody />
    </GrowthWorkspacePageContent>
  )
}
