"use client"

import { GitBranch } from "lucide-react"
import { GrowthAutomationFlowLibrary } from "@/components/growth/automation/growth-automation-flow-library"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthAutomationPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Automation Flows"
        description="Draft automation graphs for future SR-3 compilation. No execution in S5-B."
        icon={GitBranch}
        iconClassName="bg-sky-50 text-sky-600"
      />
      <GrowthAutomationFlowLibrary />
    </div>
  )
}
