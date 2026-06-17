"use client"

import { Mic } from "lucide-react"
import { GrowthVoiceDropCampaignsPanel } from "@/components/growth/growth-voice-drop-campaigns-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthCallsVoiceDropsPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Voice Drops"
        description="Controlled voicemail and voice-drop campaigns — approval-gated, compliance-aware, operator-supervised."
        icon={Mic}
        iconClassName="bg-violet-50 text-violet-700"
      />

      <GrowthVoiceDropCampaignsPanel />
    </div>
  )
}
