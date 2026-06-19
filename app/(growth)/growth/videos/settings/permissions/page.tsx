"use client"

import { Video } from "lucide-react"
import { GrowthVideoPermissionsSettingsPanel } from "@/components/growth/videos/growth-video-permissions-settings-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthVideosSettingsPermissionsPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Videos"
        description="Video Recording Studio — permissions posture."
        icon={Video}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthVideoPermissionsSettingsPanel />
    </GrowthWorkspacePageContent>
  )
}
