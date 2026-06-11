/** Apollo Multi-Channel channel intelligence — client-safe scoring. */

import type { ApolloChannelAvailability } from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import type {
  ApolloMultichannelChannelIntelligence,
  ApolloOrchestrationChannelId,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"

export const APOLLO_MULTICHANNEL_CHANNEL_INTELLIGENCE_QA_MARKER =
  "apollo-multichannel-channel-intelligence-v1" as const

function channelScore(channel: ApolloOrchestrationChannelId, availability: ApolloChannelAvailability): number {
  switch (channel) {
    case "email":
      return availability.verified_email ? 85 : availability.phone ? 20 : 0
    case "voice_drop":
      return availability.voice_drop_capable ? 80 : availability.mobile_phone ? 45 : 0
    case "sms":
      return availability.sms_capable ? 70 : 0
    case "calling":
      return availability.phone ? 65 : 0
    case "linkedin":
      return availability.linkedin ? 40 : 0
    default:
      return 15
  }
}

export function buildApolloMultichannelChannelIntelligence(input: {
  availability: ApolloChannelAvailability
  channel_order: ApolloOrchestrationChannelId[]
  prior_outreach_count?: number
}): ApolloMultichannelChannelIntelligence {
  const channels: ApolloOrchestrationChannelId[] = [
    "email",
    "voice_drop",
    "sms",
    "calling",
    "linkedin",
  ]

  const channel_scores: Record<string, number> = {}
  for (const channel of channels) {
    channel_scores[channel] = channelScore(channel, input.availability)
  }

  const ranked = [...channels].sort((a, b) => channel_scores[b]! - channel_scores[a]!)
  const strongest_channel = ranked.find((c) => channel_scores[c]! > 0) ?? null
  const highest_confidence_channel = strongest_channel

  const fallback_channels = ranked.filter(
    (c) => channel_scores[c]! > 0 && !input.channel_order.includes(c),
  )

  const unavailableCount = channels.filter((c) => channel_scores[c] === 0).length
  const channel_risk =
    unavailableCount >= 3 ? "high" : unavailableCount >= 1 ? "medium" : "low"

  const recommendations: string[] = []
  if (strongest_channel) {
    recommendations.push(`Strongest available channel: ${strongest_channel.replace(/_/g, " ")}.`)
  }
  if (input.availability.voice_drop_capable) {
    recommendations.push("Voice drop available with compliance + VD-4 readiness.")
  } else if (input.availability.mobile_phone) {
    recommendations.push("Mobile present but voice drop blocked — use SMS/call fallback.")
  }
  if ((input.prior_outreach_count ?? 0) > 0) {
    recommendations.push("Prior outreach detected — prefer lighter-touch channels first.")
  }

  return {
    strongest_channel,
    highest_confidence_channel,
    fallback_channels,
    channel_risk,
    channel_scores,
    channel_recommendations: recommendations,
    fallback_strategy:
      fallback_channels.length > 0
        ? `If primary step fails, pivot to ${fallback_channels.slice(0, 2).join(" or ")}.`
        : "No alternate channels beyond selected sequence.",
  }
}
