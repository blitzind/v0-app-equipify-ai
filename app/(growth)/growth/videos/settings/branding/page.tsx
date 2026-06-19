"use client"

import { Video } from "lucide-react"
import { GrowthVideoBrandingSettingsPanel } from "@/components/growth/videos/growth-video-branding-settings-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthVideosSettingsBrandingPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Videos"
        description="Video Recording Studio — branding defaults."
        icon={Video}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthVideoBrandingSettingsPanel />
    </GrowthWorkspacePageContent>
  )
}
