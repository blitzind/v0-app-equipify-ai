"use client"

import { GrowthVideoPageCreatePanel } from "@/components/growth/videos/growth-video-page-create-panel"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthVideosPagesNewPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthVideoPageCreatePanel />
    </GrowthWorkspacePageContent>
  )
}
