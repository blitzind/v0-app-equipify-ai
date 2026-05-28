/** Campaign + recovery analytics — Phase 5B. */

import type { VoiceObservabilityCampaignSnapshot } from "@/lib/voice/observability/types"
import { VOICE_OBSERVABILITY_QA_MARKER } from "@/lib/voice/observability/types"

export type CampaignSourceCounts = {
  voiceDropRecipients: number
  voiceDropApproved: number
  voiceDropDelivered: number
  voiceDropSuppressed: number
  missedCallRecovery24h: number
  outboundAiQueued: number
  outboundAiApproved: number
  outboundAiCompleted: number
  callbackCompleted: number
  callbackAttempted: number
  optOutTerminations24h: number
  retryAttempts: number
  totalAttempts: number
}

export function buildCampaignAnalyticsSnapshot(
  counts: CampaignSourceCounts,
): VoiceObservabilityCampaignSnapshot {
  const approvalDenom = Math.max(counts.voiceDropRecipients, 1)
  const deliveryDenom = Math.max(counts.voiceDropApproved, 1)
  const outboundDenom = Math.max(counts.outboundAiQueued, 1)
  const callbackDenom = Math.max(counts.callbackAttempted, 1)
  const retryDenom = Math.max(counts.totalAttempts, 1)

  return {
    qaMarker: VOICE_OBSERVABILITY_QA_MARKER,
    generatedAt: new Date().toISOString(),
    voiceDropApprovalRate: Math.round((counts.voiceDropApproved / approvalDenom) * 1000) / 10,
    voiceDropDeliveryRate: Math.round((counts.voiceDropDelivered / deliveryDenom) * 1000) / 10,
    voiceDropSuppressionRate: Math.round((counts.voiceDropSuppressed / approvalDenom) * 1000) / 10,
    missedCallRecoveryCount24h: counts.missedCallRecovery24h,
    outboundAiApprovalRate: Math.round((counts.outboundAiApproved / outboundDenom) * 1000) / 10,
    outboundAiCompletionRate: Math.round((counts.outboundAiCompleted / outboundDenom) * 1000) / 10,
    callbackCompletionRate: Math.round((counts.callbackCompleted / callbackDenom) * 1000) / 10,
    optOutTerminationCount24h: counts.optOutTerminations24h,
    retryRate: Math.round((counts.retryAttempts / retryDenom) * 1000) / 10,
    message: "Campaign observability — approval, delivery, suppression, and recovery trends.",
  }
}

export function emptyCampaignSourceCounts(): CampaignSourceCounts {
  return {
    voiceDropRecipients: 0,
    voiceDropApproved: 0,
    voiceDropDelivered: 0,
    voiceDropSuppressed: 0,
    missedCallRecovery24h: 0,
    outboundAiQueued: 0,
    outboundAiApproved: 0,
    outboundAiCompleted: 0,
    callbackCompleted: 0,
    callbackAttempted: 0,
    optOutTerminations24h: 0,
    retryAttempts: 0,
    totalAttempts: 0,
  }
}
