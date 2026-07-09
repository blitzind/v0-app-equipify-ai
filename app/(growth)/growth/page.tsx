"use client"

import { Home } from "lucide-react"
import { GrowthWorkspaceDashboardBody } from "@/components/growth/workspace/growth-workspace-dashboard-body"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { AI_OS_HOME_NAV_LABEL } from "@/lib/workspace/ai-os-workspace-branding"
import { teammateHomePageDescription } from "@/lib/workspace/ai-teammate-voice"

export default function GrowthWorkspaceDashboardPage() {
  const { teammate } = useAiTeammateIdentity()

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title={AI_OS_HOME_NAV_LABEL}
        description={teammateHomePageDescription(teammate)}
        icon={Home}
        iconClassName="bg-violet-50 text-violet-600"
      />

      <GrowthWorkspaceDashboardBody />
    </GrowthWorkspacePageContent>
  )
}
