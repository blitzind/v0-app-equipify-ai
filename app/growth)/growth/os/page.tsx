"use client"

import { LayoutDashboard } from "lucide-react"
import { GrowthAiOsCommandCenterPanel } from "@/components/growth/ai-os/command-center/growth-ai-os-command-center-panel"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthAiOsCommandCenterPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="AI Operations"
        description="Operator dashboard for AI activity, priorities, approvals, and health — read-only."
        icon={LayoutDashboard}
        iconClassName="bg-indigo-50 text-indigo-600"
      />
      <GrowthAiOsCommandCenterPanel />
    </GrowthWorkspacePageContent>
  )
}
