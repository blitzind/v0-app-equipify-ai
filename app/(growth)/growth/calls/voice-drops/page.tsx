"use client"

import { Mic } from "lucide-react"
import { GrowthVoiceDropCampaignsPanel } from "@/components/growth/growth-voice-drop-campaigns-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthCallsVoiceDropsPage() {
  return (
    <GrowthWorkspacePageContent className="max-w-5xl">
      <GrowthWorkspacePageHeader
        title="Voice Drops"
        description="Controlled voicemail and voice-drop campaigns — approval-gated, compliance-aware, operator-supervised."
        icon={Mic}
        iconClassName="bg-violet-50 text-violet-700"
      />

      <GrowthVoiceDropCampaignsPanel />
    </GrowthWorkspacePageContent>
  )
}
