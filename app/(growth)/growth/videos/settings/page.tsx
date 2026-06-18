"use client"

import { Video } from "lucide-react"
import { GrowthVideoSettingsShell } from "@/components/growth/videos/growth-video-settings-shell"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthVideosSettingsPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Videos"
        description="Video Recording Studio — library, capture, templates, analytics, and settings."
        icon={Video}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthVideoSettingsShell />
    </GrowthWorkspacePageContent>
  )
}
