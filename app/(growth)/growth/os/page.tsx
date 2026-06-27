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
        description="Advanced engineering and diagnostics workspace — operator dashboard, approvals context, and full AI OS read models."
        icon={LayoutDashboard}
        iconClassName="bg-indigo-50 text-indigo-600"
      />
      <GrowthAiOsCommandCenterPanel />
    </GrowthWorkspacePageContent>
  )
}
