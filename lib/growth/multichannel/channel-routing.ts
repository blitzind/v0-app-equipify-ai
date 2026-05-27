import type {
  GrowthChannelRoutingRule,
  GrowthSequenceChannelType,
} from "@/lib/growth/multichannel/multichannel-types"
import { isFuturePlaceholderChannel } from "@/lib/growth/multichannel/multichannel-types"

export function selectChannelRoutingRule(
  rules: GrowthChannelRoutingRule[],
  channel: GrowthSequenceChannelType,
): GrowthChannelRoutingRule | null {
  const active = rules
    .filter((rule) => rule.isActive && rule.channel === channel)
    .sort((a, b) => a.priority - b.priority)
  return active[0] ?? null
}

export function channelRequiresApproval(
  rules: GrowthChannelRoutingRule[],
  channel: GrowthSequenceChannelType,
): boolean {
  const rule = selectChannelRoutingRule(rules, channel)
  if (isFuturePlaceholderChannel(channel)) return true
  return rule?.requiresApproval ?? true
}

export function channelIsBlockedPlaceholder(
  rules: GrowthChannelRoutingRule[],
  channel: GrowthSequenceChannelType,
): boolean {
  if (isFuturePlaceholderChannel(channel)) return true
  const rule = selectChannelRoutingRule(rules, channel)
  return Boolean(rule?.isFuturePlaceholder)
}

export function mapEnrollmentChannelToMultichannel(
  channel: string,
): GrowthSequenceChannelType | null {
  switch (channel) {
    case "email":
      return "email"
    case "manual_call":
      return "manual_call"
    case "manual_followup":
      return "manual_followup"
    case "linkedin":
      return "linkedin_manual"
    case "sms_future":
      return "sms_future"
    case "booking_followup":
      return "booking_followup"
    case "voicemail_future":
      return "voicemail_future"
    default:
      return null
  }
}
