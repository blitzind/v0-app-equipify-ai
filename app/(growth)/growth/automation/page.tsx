"use client"

import { GitBranch } from "lucide-react"
import { GrowthAutomationFlowLibrary } from "@/components/growth/automation/growth-automation-flow-library"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthAutomationPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Automation Flows"
        description="Draft automation graphs for future SR-3 compilation. No execution in S5-B."
        icon={GitBranch}
        iconClassName="bg-sky-50 text-sky-600"
      />
      <GrowthAutomationFlowLibrary />
    </GrowthWorkspacePageContent>
  )
}
