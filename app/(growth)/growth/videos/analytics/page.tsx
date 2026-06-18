"use client"

import { Video } from "lucide-react"
import { GrowthVideoAnalyticsShell } from "@/components/growth/videos/growth-video-analytics-shell"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthVideosAnalyticsPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Videos"
        description="Video Recording Studio — library, capture, templates, analytics, and settings."
        icon={Video}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthVideoAnalyticsShell />
    </GrowthWorkspacePageContent>
  )
}
