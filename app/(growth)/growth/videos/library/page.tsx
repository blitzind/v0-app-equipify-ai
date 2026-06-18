"use client"

import { Video } from "lucide-react"
import { GrowthVideoLibraryPanel } from "@/components/growth/videos/growth-video-library-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthVideosLibraryPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Videos"
        description="Video Recording Studio — library, capture, templates, analytics, and settings."
        icon={Video}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthVideoLibraryPanel />
    </GrowthWorkspacePageContent>
  )
}
