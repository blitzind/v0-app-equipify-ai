"use client"

import { Video } from "lucide-react"
import { GrowthVideoPageCreatePanel } from "@/components/growth/videos/growth-video-page-create-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthVideosPagesNewPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Videos"
        description="Create a new shareable video page."
        icon={Video}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthVideoPageCreatePanel />
    </GrowthWorkspacePageContent>
  )
}
