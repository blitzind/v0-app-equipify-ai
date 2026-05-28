/** Communication health monitoring — Phase 6A. No autonomous suppression. */

import type {
  VoiceCommunicationHealthSummary,
  VoiceUnifiedCommunicationEventPublicView,
  VoiceUnifiedCommunicationThreadPublicView,
} from "@/lib/voice/multi-channel-intelligence/types"
import {
  VOICE_MULTICHANNEL_FATIGUE_CONTACT_THRESHOLD,
} from "@/lib/voice/multi-channel-intelligence/types"

export function buildCommunicationHealthSummary(input: {
  threads: VoiceUnifiedCommunicationThreadPublicView[]
  events: VoiceUnifiedCommunicationEventPublicView[]
}): VoiceCommunicationHealthSummary {
  const { threads, events } = input

  const contactAttempts = events.filter(
    (e) =>
      e.eventType === "callback_completed" ||
      e.eventType === "voicemail_left" ||
      e.eventType === "outbound_ai_completed" ||
      e.eventType === "voice_call_completed",
  ).length

  const fatigueCount = threads.filter((t) => {
    const threadEvents = events.filter((e) => e.threadId === t.id)
    return threadEvents.length >= VOICE_MULTICHANNEL_FATIGUE_CONTACT_THRESHOLD
  }).length

  const voicemailFailures = events.filter(
    (e) => e.channel === "voicemail" && e.eventType === "communication_failed",
  ).length

  const unansweredCallbacks = events.filter(
    (e) => e.channel === "callback" && e.eventType === "communication_failed",
  ).length

  const escalations = events.filter((e) => e.eventType === "escalation_triggered").length
  const unresolvedChains = threads.filter((t) => t.unresolvedIssueCount >= 2).length

  const responseDelays = detectResponseDelays(events)
  const channelAbandonment = events.filter(
    (e) => e.eventType === "channel_transition" && e.payload.success === false,
  ).length

  const riskScore =
    fatigueCount * 2 +
    unresolvedChains * 3 +
    escalations +
    voicemailFailures +
    unansweredCallbacks

  let relationshipCommunicationRisk: "low" | "medium" | "high" = "low"
  if (riskScore >= 8) relationshipCommunicationRisk = "high"
  else if (riskScore >= 4) relationshipCommunicationRisk = "medium"

  const engagementContinuityScore = Math.max(0, 100 - riskScore * 5)

  return {
    fatigueCount,
    excessiveContactAttempts: contactAttempts >= VOICE_MULTICHANNEL_FATIGUE_CONTACT_THRESHOLD ? contactAttempts : 0,
    unresolvedChainCount: unresolvedChains,
    repeatedEscalationCount: escalations >= 2 ? escalations : 0,
    voicemailFailureCount: voicemailFailures,
    unansweredCallbackCount: unansweredCallbacks,
    responseDelayCount: responseDelays,
    channelAbandonmentCount: channelAbandonment,
    relationshipCommunicationRisk,
    engagementContinuityScore,
  }
}

function detectResponseDelays(events: VoiceUnifiedCommunicationEventPublicView[]): number {
  const sorted = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  let delays = 0
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    if (!prev || !curr) continue
    const gapHours = (new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime()) / (1000 * 60 * 60)
    if (
      gapHours > 48 &&
      prev.eventType === "followup_recommended" &&
      curr.eventType !== "communication_resolved"
    ) {
      delays += 1
    }
  }
  return delays
}

export function detectCommunicationFatigue(
  events: VoiceUnifiedCommunicationEventPublicView[],
): boolean {
  const contactEvents = events.filter(
    (e) =>
      e.eventType === "callback_completed" ||
      e.eventType === "voicemail_left" ||
      e.eventType === "outbound_ai_completed",
  )
  return contactEvents.length >= VOICE_MULTICHANNEL_FATIGUE_CONTACT_THRESHOLD
}

export function detectUnresolvedCommunications(
  threads: VoiceUnifiedCommunicationThreadPublicView[],
): VoiceUnifiedCommunicationThreadPublicView[] {
  return threads.filter(
    (t) =>
      t.unresolvedIssueCount > 0 &&
      ["active", "awaiting_customer", "awaiting_operator", "escalated", "stalled"].includes(t.currentState),
  )
}
