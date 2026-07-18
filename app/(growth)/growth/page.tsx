"use client"

import { Home, LayoutGrid } from "lucide-react"
import { GrowthWorkspaceDashboardBody } from "@/components/growth/workspace/growth-workspace-dashboard-body"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { AI_OS_HOME_NAV_LABEL } from "@/lib/workspace/ai-os-workspace-branding"
import { teammateHomePageDescription } from "@/lib/workspace/ai-teammate-voice"
import { isGrowthWorkspaceFirstUx1aEnabledClient } from "@/lib/growth/navigation/growth-workspace-first-ux-1a-feature"
import { GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS } from "@/lib/growth/navigation/growth-workspace-first-ux-1a-labels"

export default function GrowthWorkspaceDashboardPage() {
  const { teammate } = useAiTeammateIdentity()
  const ux1aActive = isGrowthWorkspaceFirstUx1aEnabledClient()

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title={ux1aActive ? GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS.workspace : AI_OS_HOME_NAV_LABEL}
        description={ux1aActive ? undefined : teammateHomePageDescription(teammate)}
        icon={ux1aActive ? LayoutGrid : Home}
        iconClassName="bg-violet-50 text-violet-600"
      />

      <GrowthWorkspaceDashboardBody />
    </GrowthWorkspacePageContent>
  )
}
