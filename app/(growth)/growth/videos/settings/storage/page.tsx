"use client"

import { Video } from "lucide-react"
import { GrowthVideoStorageSettingsPanel } from "@/components/growth/videos/growth-video-storage-settings-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthVideosSettingsStoragePage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Videos"
        description="Video Recording Studio — storage configuration."
        icon={Video}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthVideoStorageSettingsPanel />
    </GrowthWorkspacePageContent>
  )
}
