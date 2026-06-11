/** Apollo Multi-Channel sequence templates — client-safe. */

import type {
  ApolloChannelAvailability,
  ApolloOutreachChannelId,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import type {
  ApolloMultichannelSequenceTemplate,
  ApolloOrchestrationChannelId,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"

export const APOLLO_MULTICHANNEL_SEQUENCE_TEMPLATES_QA_MARKER =
  "apollo-multichannel-sequence-templates-v1" as const

export const APOLLO_MULTICHANNEL_SEQUENCE_VERSION = "v1" as const

type TemplateDef = {
  sequence_key: string
  sequence_label: string
  channels: ApolloOrchestrationChannelId[]
  requires: (a: ApolloChannelAvailability) => boolean
  recommendation_reason: string
  priority: number
}

function mapChannel(channel: ApolloOutreachChannelId): ApolloOrchestrationChannelId {
  if (channel === "phone" || channel === "mobile_phone") return "calling"
  if (channel === "voice_drop") return "voice_drop"
  if (channel === "sms") return "sms"
  if (channel === "email") return "email"
  if (channel === "linkedin") return "linkedin"
  return "future_channel"
}

const TEMPLATES: TemplateDef[] = [
  {
    sequence_key: "email_voice_drop",
    sequence_label: "Email → Voice Drop",
    channels: ["email", "voice_drop"],
    requires: (a) => a.verified_email && a.voice_drop_capable,
    recommendation_reason: "Warm inbox intro followed by mobile voice reinforcement.",
    priority: 90,
  },
  {
    sequence_key: "email_sms",
    sequence_label: "Email → SMS",
    channels: ["email", "sms"],
    requires: (a) => a.verified_email && a.sms_capable,
    recommendation_reason: "Email intro with SMS persistence for mobile-first follow-up.",
    priority: 75,
  },
  {
    sequence_key: "voice_drop_email",
    sequence_label: "Voice Drop → Email",
    channels: ["voice_drop", "email"],
    requires: (a) => a.voice_drop_capable && a.verified_email,
    recommendation_reason: "Mobile-first voice touch then email confirmation.",
    priority: 85,
  },
  {
    sequence_key: "email_voice_sms",
    sequence_label: "Email → Voice Drop → SMS",
    channels: ["email", "voice_drop", "sms"],
    requires: (a) => a.verified_email && a.voice_drop_capable && a.sms_capable,
    recommendation_reason: "Full async multichannel cadence across inbox, voicemail, and SMS.",
    priority: 95,
  },
  {
    sequence_key: "voice_sms_email",
    sequence_label: "Voice Drop → SMS → Email",
    channels: ["voice_drop", "sms", "email"],
    requires: (a) => a.voice_drop_capable && a.sms_capable && a.verified_email,
    recommendation_reason: "Aggressive mobile-first escalation ending with email recap.",
    priority: 80,
  },
  {
    sequence_key: "call_email",
    sequence_label: "Call → Email",
    channels: ["calling", "email"],
    requires: (a) => a.phone && a.verified_email,
    recommendation_reason: "Direct call attempt with email follow-up for non-connects.",
    priority: 70,
  },
  {
    sequence_key: "call_sms",
    sequence_label: "Call → SMS",
    channels: ["calling", "sms"],
    requires: (a) => a.phone && a.sms_capable,
    recommendation_reason: "Live call attempt with SMS backup when unanswered.",
    priority: 65,
  },
  {
    sequence_key: "custom_future",
    sequence_label: "Custom Future Sequence",
    channels: ["future_channel"],
    requires: () => true,
    recommendation_reason: "Placeholder for future channel expansion when primary mix unavailable.",
    priority: 10,
  },
]

export function listApolloMultichannelSequenceTemplates(): ApolloMultichannelSequenceTemplate[] {
  return TEMPLATES.map((template) => ({
    sequence_key: template.sequence_key,
    sequence_version: APOLLO_MULTICHANNEL_SEQUENCE_VERSION,
    sequence_label: template.sequence_label,
    channel_order: template.channels,
    recommendation_reason: template.recommendation_reason,
  }))
}

export function selectApolloMultichannelSequenceTemplate(input: {
  availability: ApolloChannelAvailability
  preferred_strategy_key?: string | null
}): ApolloMultichannelSequenceTemplate {
  if (input.preferred_strategy_key) {
    const preferred = TEMPLATES.find((t) => t.sequence_key === input.preferred_strategy_key)
    if (preferred && preferred.requires(input.availability)) {
      return {
        sequence_key: preferred.sequence_key,
        sequence_version: APOLLO_MULTICHANNEL_SEQUENCE_VERSION,
        sequence_label: preferred.sequence_label,
        channel_order: preferred.channels,
        recommendation_reason: preferred.recommendation_reason,
      }
    }
  }

  const eligible = TEMPLATES.filter(
    (t) => t.sequence_key !== "custom_future" && t.requires(input.availability),
  ).sort((a, b) => b.priority - a.priority)

  const match = eligible[0] ?? TEMPLATES.find((t) => t.sequence_key === "custom_future")!
  return {
    sequence_key: match.sequence_key,
    sequence_version: APOLLO_MULTICHANNEL_SEQUENCE_VERSION,
    sequence_label: match.sequence_label,
    channel_order: match.channels,
    recommendation_reason: match.recommendation_reason,
  }
}

export function mapVoiceDropChannelsToOrchestration(
  channels: ApolloOutreachChannelId[],
): ApolloOrchestrationChannelId[] {
  return channels.map(mapChannel)
}
