"use client"

import { BookOpen } from "lucide-react"
import { GrowthLaunchRunbookPanel } from "@/components/growth/operational/growth-launch-runbook-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthLaunchRunbookPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Launch Runbook"
        description="How to Launch an Equipify Campaign — prospect search through booked demo."
        icon={BookOpen}
        iconClassName="bg-indigo-50 text-indigo-600"
      />
      <GrowthLaunchRunbookPanel embedded />
    </GrowthWorkspacePageContent>
  )
}
