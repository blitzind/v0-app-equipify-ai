"use client"

import { Target } from "lucide-react"
import { GrowthObjectivesDashboard } from "@/components/growth/objectives/growth-objectives-dashboard"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthObjectivesPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Objectives"
        description="Objective-driven plans coordinate discovery, assets, campaigns, and adaptation toward measurable outcomes."
        icon={Target}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthObjectivesDashboard />
    </GrowthWorkspacePageContent>
  )
}
