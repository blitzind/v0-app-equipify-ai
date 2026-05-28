/** Voice drop dashboard snapshot builder — Phase 4B. */

import type {
  VoiceDropCampaignDashboardSnapshot,
  VoiceDropCampaignPublicView,
} from "@/lib/voice/voice-drops/types"
import { VOICE_DROP_INFRASTRUCTURE_QA_MARKER } from "@/lib/voice/voice-drops/types"

export function buildVoiceDropCampaignDashboardSnapshot(
  campaigns: VoiceDropCampaignPublicView[],
): VoiceDropCampaignDashboardSnapshot {
  return {
    qaMarker: VOICE_DROP_INFRASTRUCTURE_QA_MARKER,
    generatedAt: new Date().toISOString(),
    campaigns,
    pendingApprovalCount: campaigns.filter((c) => c.approvalStatus === "pending_approval").length,
    runningCount: campaigns.filter((c) => c.status === "running").length,
    autonomousOutboundDisabled: true,
    approvalRequired: true,
    message: "Voice drop campaigns are approval-gated — no autonomous outbound delivery.",
  }
}
