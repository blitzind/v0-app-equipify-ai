"use client"

import { Home } from "lucide-react"
import { GrowthWorkspaceDashboardBody } from "@/components/growth/workspace/growth-workspace-dashboard-body"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { AI_OS_HOME_NAV_LABEL } from "@/lib/workspace/ai-os-workspace-branding"

export default function GrowthWorkspaceDashboardPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title={AI_OS_HOME_NAV_LABEL}
        description={`Ava's daily operating report — today's work, progress, and decisions.`}
        icon={Home}
        iconClassName="bg-violet-50 text-violet-600"
      />

      <GrowthWorkspaceDashboardBody />
    </GrowthWorkspacePageContent>
  )
}
