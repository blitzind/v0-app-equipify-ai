/** Preferred channel detection — Phase 6A. Evidence-backed, operator-visible. */

import type {
  VoicePreferredChannelInsight,
  VoiceUnifiedCommunicationChannel,
  VoiceUnifiedCommunicationEventPublicView,
} from "@/lib/voice/multi-channel-intelligence/types"
import {
  VOICE_MULTICHANNEL_HIDDEN_SCORING_DISABLED,
} from "@/lib/voice/multi-channel-intelligence/types"

type ChannelStats = {
  channel: VoiceUnifiedCommunicationChannel
  successCount: number
  failureCount: number
  responseEvents: number
  escalationCount: number
  operatorTakeoverCount: number
}

export function detectPreferredChannels(
  events: VoiceUnifiedCommunicationEventPublicView[],
  operatorOverride?: VoiceUnifiedCommunicationChannel | null,
): VoicePreferredChannelInsight[] {
  if (operatorOverride) {
    return [
      {
        channel: operatorOverride,
        reason: "Operator override — preferred channel set manually.",
        confidence: "high",
        evidenceCount: 0,
        operatorOverrideAllowed: true,
        hiddenScoringDisabled: VOICE_MULTICHANNEL_HIDDEN_SCORING_DISABLED,
      },
    ]
  }

  const stats = aggregateChannelStats(events)
  const insights: VoicePreferredChannelInsight[] = []

  for (const stat of stats) {
    const total = stat.successCount + stat.failureCount
    if (total === 0) continue

    const successRate = stat.successCount / total

    if (stat.channel === "callback" && successRate >= 0.6 && stat.responseEvents >= 2) {
      insights.push({
        channel: "callback",
        reason: "Responds faster to callbacks — evidence from completed callback events.",
        confidence: successRate >= 0.8 ? "high" : "medium",
        evidenceCount: stat.successCount,
        operatorOverrideAllowed: true,
        hiddenScoringDisabled: VOICE_MULTICHANNEL_HIDDEN_SCORING_DISABLED,
      })
    }

    if (stat.channel === "voicemail" && stat.successCount >= 2 && stat.failureCount === 0) {
      insights.push({
        channel: "voicemail",
        reason: "Prefers voicemail — successful voicemail interactions recorded.",
        confidence: "medium",
        evidenceCount: stat.successCount,
        operatorOverrideAllowed: true,
        hiddenScoringDisabled: VOICE_MULTICHANNEL_HIDDEN_SCORING_DISABLED,
      })
    }

    if (stat.channel === "outbound_ai" && stat.failureCount >= 2) {
      insights.push({
        channel: "voice",
        reason: "Avoids outbound AI — repeated failures; operator callback recommended.",
        confidence: "medium",
        evidenceCount: stat.failureCount,
        operatorOverrideAllowed: true,
        hiddenScoringDisabled: VOICE_MULTICHANNEL_HIDDEN_SCORING_DISABLED,
      })
    }

    if (stat.operatorTakeoverCount >= 2) {
      insights.push({
        channel: "voice",
        reason: "Prefers operator takeover — repeated operator join events.",
        confidence: "high",
        evidenceCount: stat.operatorTakeoverCount,
        operatorOverrideAllowed: true,
        hiddenScoringDisabled: VOICE_MULTICHANNEL_HIDDEN_SCORING_DISABLED,
      })
    }

    if (stat.channel === "scheduling" && stat.successCount >= 1) {
      insights.push({
        channel: "scheduling",
        reason: "Scheduling preference detected — scheduling events completed.",
        confidence: "medium",
        evidenceCount: stat.successCount,
        operatorOverrideAllowed: true,
        hiddenScoringDisabled: VOICE_MULTICHANNEL_HIDDEN_SCORING_DISABLED,
      })
    }
  }

  if (insights.length === 0 && events.length > 0) {
    const topChannel = stats.sort((a, b) => b.successCount - a.successCount)[0]
    if (topChannel && topChannel.successCount > 0) {
      insights.push({
        channel: topChannel.channel,
        reason: `Most successful channel by event count (${topChannel.successCount} events).`,
        confidence: "low",
        evidenceCount: topChannel.successCount,
        operatorOverrideAllowed: true,
        hiddenScoringDisabled: VOICE_MULTICHANNEL_HIDDEN_SCORING_DISABLED,
      })
    }
  }

  return insights.slice(0, 5)
}

function aggregateChannelStats(events: VoiceUnifiedCommunicationEventPublicView[]): ChannelStats[] {
  const map = new Map<VoiceUnifiedCommunicationChannel, ChannelStats>()

  for (const event of events) {
    const existing = map.get(event.channel) ?? {
      channel: event.channel,
      successCount: 0,
      failureCount: 0,
      responseEvents: 0,
      escalationCount: 0,
      operatorTakeoverCount: 0,
    }

    if (event.eventType === "communication_failed") {
      existing.failureCount += 1
    } else if (
      event.eventType === "voice_call_completed" ||
      event.eventType === "callback_completed" ||
      event.eventType === "communication_resolved" ||
      event.eventType === "scheduling_completed"
    ) {
      existing.successCount += 1
      existing.responseEvents += 1
    } else if (event.eventType === "escalation_triggered") {
      existing.escalationCount += 1
    } else if (event.eventType === "operator_takeover") {
      existing.operatorTakeoverCount += 1
    }

    map.set(event.channel, existing)
  }

  return [...map.values()]
}

export function detectAfterHoursEngagement(events: VoiceUnifiedCommunicationEventPublicView[]): boolean {
  const afterHoursEvents = events.filter((e) => {
    const hour = new Date(e.createdAt).getHours()
    return hour < 8 || hour >= 18
  })
  return afterHoursEvents.length >= 2
}
