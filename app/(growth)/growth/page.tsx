"use client"

import { LayoutDashboard } from "lucide-react"
import { GrowthWorkspaceDashboardBody } from "@/components/growth/workspace/growth-workspace-dashboard-body"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthWorkspaceDashboardPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Operator Home"
        description="Daily queue, activity, pipeline, campaigns, and intelligence — your Growth workspace starting point."
        icon={LayoutDashboard}
        iconClassName="bg-violet-50 text-violet-600"
      />

      <GrowthWorkspaceDashboardBody />
    </div>
  )
}
