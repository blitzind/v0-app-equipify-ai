"use client"

import { Video } from "lucide-react"
import { GrowthVideoRecordingSettingsPanel } from "@/components/growth/videos/growth-video-recording-settings-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthVideosSettingsRecordingPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Videos"
        description="Video Recording Studio — recording defaults."
        icon={Video}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthVideoRecordingSettingsPanel />
    </GrowthWorkspacePageContent>
  )
}
