/** Channel continuity tracking — Phase 6A. No auto channel switching. */

import type {
  VoiceChannelTransitionRecord,
  VoiceUnifiedCommunicationChannel,
  VoiceUnifiedCommunicationEventPublicView,
} from "@/lib/voice/multi-channel-intelligence/types"

export type ChannelContinuitySummary = {
  channelsVisited: VoiceUnifiedCommunicationChannel[]
  transitionCount: number
  failedTransitions: number
  lastSuccessfulChannel: VoiceUnifiedCommunicationChannel | null
  continuityBroken: boolean
  evidence: string[]
}

export function extractChannelTransitions(
  events: VoiceUnifiedCommunicationEventPublicView[],
): VoiceChannelTransitionRecord[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  const transitions: VoiceChannelTransitionRecord[] = []
  let lastChannel: VoiceUnifiedCommunicationChannel | null = null

  for (const event of sorted) {
    if (event.eventType === "channel_transition") {
      const fromChannel =
        (event.payload.fromChannel as VoiceUnifiedCommunicationChannel | undefined) ?? lastChannel
      transitions.push({
        fromChannel,
        toChannel: event.channel,
        success: event.payload.success !== false,
        evidence: event.evidenceText,
        timestamp: event.createdAt,
      })
      lastChannel = event.channel
      continue
    }

    if (lastChannel && lastChannel !== event.channel) {
      transitions.push({
        fromChannel: lastChannel,
        toChannel: event.channel,
        success: event.eventType !== "communication_failed",
        evidence: `${lastChannel} → ${event.channel}: ${event.evidenceText}`,
        timestamp: event.createdAt,
      })
    }
    lastChannel = event.channel
  }

  return transitions
}

export function summarizeChannelContinuity(
  events: VoiceUnifiedCommunicationEventPublicView[],
): ChannelContinuitySummary {
  const transitions = extractChannelTransitions(events)
  const channelsVisited = [...new Set(events.map((e) => e.channel))]
  const failedTransitions = transitions.filter((t) => !t.success).length
  const lastSuccess = [...transitions].reverse().find((t) => t.success)

  return {
    channelsVisited,
    transitionCount: transitions.length,
    failedTransitions,
    lastSuccessfulChannel: lastSuccess?.toChannel ?? events[events.length - 1]?.channel ?? null,
    continuityBroken: failedTransitions >= 2,
    evidence: transitions.slice(-5).map((t) => t.evidence),
  }
}

export function detectFailedChannels(
  events: VoiceUnifiedCommunicationEventPublicView[],
): VoiceUnifiedCommunicationChannel[] {
  const failed = new Set<VoiceUnifiedCommunicationChannel>()
  for (const event of events) {
    if (event.eventType === "communication_failed") {
      failed.add(event.channel)
    }
  }
  return [...failed]
}
