"use client"

import { Video } from "lucide-react"
import { GrowthVideoPagesPanel } from "@/components/growth/videos/growth-video-pages-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthVideosPagesPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Videos"
        description="Branded shareable video pages for Equipify outreach."
        icon={Video}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthVideoPagesPanel />
    </GrowthWorkspacePageContent>
  )
}
