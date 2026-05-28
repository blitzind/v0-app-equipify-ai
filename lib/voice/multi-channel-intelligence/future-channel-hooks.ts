/** Future SMS/email/portal hook infrastructure — Phase 6A. Event-safe placeholders only. */

import type {
  VoiceUnifiedCommunicationChannel,
  VoiceUnifiedCommunicationEventType,
} from "@/lib/voice/multi-channel-intelligence/types"

export const FUTURE_CHANNEL_HOOKS = ["sms", "email", "portal"] as const satisfies readonly VoiceUnifiedCommunicationChannel[]

export type FutureChannelHookEventType =
  | "sms_event_recorded"
  | "email_event_recorded"
  | "portal_message_recorded"

export function isFutureChannelHook(channel: VoiceUnifiedCommunicationChannel): boolean {
  return (FUTURE_CHANNEL_HOOKS as readonly string[]).includes(channel)
}

export function futureChannelEventType(
  channel: VoiceUnifiedCommunicationChannel,
): VoiceUnifiedCommunicationEventType | null {
  switch (channel) {
    case "sms":
      return "sms_event_recorded"
    case "email":
      return "email_event_recorded"
    case "portal":
      return "portal_message_recorded"
    default:
      return null
  }
}

export function validateFutureChannelHook(input: {
  channel: VoiceUnifiedCommunicationChannel
  eventType: VoiceUnifiedCommunicationEventType
}): { allowed: boolean; reason: string } {
  if (!isFutureChannelHook(input.channel)) {
    return { allowed: true, reason: "Active channel — not a future hook." }
  }

  const expectedType = futureChannelEventType(input.channel)
  if (expectedType && input.eventType !== expectedType) {
    return {
      allowed: false,
      reason: `Future channel ${input.channel} requires event type ${expectedType}.`,
    }
  }

  return {
    allowed: true,
    reason: "Future channel hook — intelligence recording only, no sending implementation.",
  }
}

export function futureChannelHookEvidence(channel: VoiceUnifiedCommunicationChannel): string {
  return `${channel.toUpperCase()} event recorded — placeholder hook, no autonomous send.`
}
