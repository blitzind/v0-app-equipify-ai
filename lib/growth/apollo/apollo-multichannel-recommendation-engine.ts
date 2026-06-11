/** Apollo multichannel recommendation engine — client-safe. */

import type {
  ApolloChannelAvailability,
  ApolloChannelRecommendation,
  ApolloMultichannelStrategy,
  ApolloOutreachChannelId,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-types"

export const APOLLO_MULTICHANNEL_RECOMMENDATION_QA_MARKER =
  "apollo-multichannel-recommendation-v1" as const

const STRATEGY_TEMPLATES: Array<{
  key: string
  label: string
  channels: ApolloOutreachChannelId[]
  delays: number[]
  requires: (availability: ApolloChannelAvailability) => boolean
  reasoning: string
}> = [
  {
    key: "email_voice_sms",
    label: "Email → Voice Drop → SMS",
    channels: ["email", "voice_drop", "sms"],
    delays: [0, 3, 2],
    requires: (a) => a.verified_email && a.voice_drop_capable && a.sms_capable,
    reasoning: "Verified inbox intro, mobile voice reinforcement, SMS persistence.",
  },
  {
    key: "email_voice",
    label: "Email → Voice Drop",
    channels: ["email", "voice_drop"],
    delays: [0, 3],
    requires: (a) => a.verified_email && a.voice_drop_capable,
    reasoning: "Email warms the account; voice drop adds human touch on mobile.",
  },
  {
    key: "voice_email",
    label: "Voice Drop → Email",
    channels: ["voice_drop", "email"],
    delays: [0, 2],
    requires: (a) => a.voice_drop_capable && a.verified_email,
    reasoning: "Mobile-first reach when email inbox is crowded; email confirms details.",
  },
  {
    key: "email_sms_voice",
    label: "Email → SMS → Voice Drop",
    channels: ["email", "sms", "voice_drop"],
    delays: [0, 2, 3],
    requires: (a) => a.verified_email && a.sms_capable && a.voice_drop_capable,
    reasoning: "Progressive multichannel escalation ending with voice drop.",
  },
  {
    key: "email_only",
    label: "Email-first nurture",
    channels: ["email"],
    delays: [0],
    requires: (a) => a.verified_email,
    reasoning: "Email-only when voice/SMS channels unavailable.",
  },
]

export function recommendApolloMultichannelStrategy(input: {
  availability: ApolloChannelAvailability
  channel_recommendation: ApolloChannelRecommendation
  qualification_score: number
}): ApolloMultichannelStrategy {
  const match =
    STRATEGY_TEMPLATES.find((template) => template.requires(input.availability)) ??
    STRATEGY_TEMPLATES[STRATEGY_TEMPLATES.length - 1]

  const confidence = Math.min(
    100,
    Math.round(
      input.channel_recommendation.confidence_score * 0.5 +
        input.qualification_score * 0.3 +
        (input.availability.voice_drop_capable ? 20 : 0),
    ),
  )

  return {
    strategy_key: match.key,
    strategy_label: match.label,
    steps: match.channels.map((channel, index) => ({
      channel,
      delay_days: match.delays[index] ?? 0,
      reason:
        channel === "email"
          ? "Low-friction intro with verified deliverability."
          : channel === "voice_drop"
            ? "Personalized voicemail on mobile when compliance allows."
            : channel === "sms"
              ? "Short-form follow-up between async touches."
              : "Channel-specific follow-up step.",
    })),
    recommendation_source: "apollo_multichannel_recommendation_engine",
    confidence,
    reasoning: match.reasoning,
  }
}

export function summarizeRecommendedChannelMix(
  strategies: ApolloMultichannelStrategy[],
): Record<string, number> {
  const mix: Record<string, number> = {}
  for (const strategy of strategies) {
    mix[strategy.strategy_key] = (mix[strategy.strategy_key] ?? 0) + 1
  }
  return mix
}
