"use client"

import { Activity } from "lucide-react"
import { GrowthActivityWorkspace } from "@/components/growth/activity/growth-activity-workspace"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthActivityPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Activity"
        description="Unified prospect activity timeline — communication, content, sales, AI, and intelligence signals."
        icon={Activity}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthActivityWorkspace />
    </GrowthWorkspacePageContent>
  )
}
