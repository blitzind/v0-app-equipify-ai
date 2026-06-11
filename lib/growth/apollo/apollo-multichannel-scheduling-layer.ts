/** Apollo Multi-Channel scheduling layer — timing plan only, no job execution. */

import type {
  ApolloMultichannelSchedulingPlan,
  ApolloMultichannelSchedulingTouch,
  ApolloOrchestrationChannelId,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"

export const APOLLO_MULTICHANNEL_SCHEDULING_LAYER_QA_MARKER =
  "apollo-multichannel-scheduling-layer-v1" as const

const DEFAULT_SPACING: Record<ApolloOrchestrationChannelId, number> = {
  email: 0,
  voice_drop: 3,
  sms: 2,
  calling: 1,
  linkedin: 2,
  future_channel: 5,
}

const CADENCE_BY_CHANNEL: Record<ApolloOrchestrationChannelId, string> = {
  email: "async_inbox",
  voice_drop: "mobile_voicemail",
  sms: "mobile_text",
  calling: "live_call_window",
  linkedin: "social_async",
  future_channel: "future_placeholder",
}

export function buildApolloMultichannelSchedulingPlan(input: {
  channel_order: ApolloOrchestrationChannelId[]
  prior_outreach_count?: number
}): ApolloMultichannelSchedulingPlan {
  const spacingBoost = (input.prior_outreach_count ?? 0) >= 2 ? 1 : 0
  const touches: ApolloMultichannelSchedulingTouch[] = []
  let dayOffset = 1
  let priorChannel: ApolloOrchestrationChannelId | null = null

  for (let index = 0; index < input.channel_order.length; index += 1) {
    const channel = input.channel_order[index]!
    const spacing =
      index === 0 ? 0 : (DEFAULT_SPACING[channel] ?? 2) + spacingBoost

    if (index > 0) {
      dayOffset += spacing
    }

    touches.push({
      day_offset: dayOffset,
      channel,
      spacing_days_from_prior: spacing,
      cadence_label: CADENCE_BY_CHANNEL[channel],
      reason:
        index === 0
          ? `Day ${dayOffset} opening ${channel} touch.`
          : `${spacing}-day spacing after ${priorChannel} before ${channel}.`,
    })
    priorChannel = channel
  }

  const total_days = touches.length ? touches[touches.length - 1]!.day_offset : 0

  return {
    plan_version: "v1",
    total_days,
    spacing_strategy:
      spacingBoost > 0 ? "conservative_spacing_with_prior_outreach" : "standard_multichannel_spacing",
    channel_cadence: touches.map((t) => `${t.cadence_label}@day${t.day_offset}`).join(" → "),
    touches,
  }
}

export function formatSchedulingPlanSummary(plan: ApolloMultichannelSchedulingPlan): string {
  return plan.touches
    .map((touch) => `Day ${touch.day_offset} ${touch.channel.replace(/_/g, " ")}`)
    .join(" · ")
}
