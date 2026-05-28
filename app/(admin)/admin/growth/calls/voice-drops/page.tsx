import { GrowthVoiceDropCampaignsPanel } from "@/components/growth/growth-voice-drop-campaigns-panel"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function GrowthVoiceDropsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <p className={PAGE_STANDARD_PAGE_TITLE}>Voice Drops</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Controlled voicemail and voice-drop campaigns — approval-gated, compliance-aware, operator-supervised.
        </p>
      </div>
      <GrowthVoiceDropCampaignsPanel />
    </div>
  )
}
