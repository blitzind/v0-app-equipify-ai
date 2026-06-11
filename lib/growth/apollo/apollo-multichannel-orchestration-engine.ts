/** Multi-Channel Orchestration Engine — client-safe recommendation core. */

import type {
  ApolloMultichannelOrchestrationInput,
  ApolloMultichannelOrchestrationResult,
  ApolloOrchestrationChannelId,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import { selectApolloMultichannelSequenceTemplate } from "@/lib/growth/apollo/apollo-multichannel-sequence-templates"

export const APOLLO_MULTICHANNEL_ORCHESTRATION_ENGINE_QA_MARKER =
  "apollo-multichannel-orchestration-engine-v1" as const

function scoreChannelForOrchestration(
  channel: ApolloOrchestrationChannelId,
  input: ApolloMultichannelOrchestrationInput,
): number {
  const a = input.available_channels
  const fit = (input.fit_score ?? input.qualification_score) / 100
  switch (channel) {
    case "email":
      return a.verified_email ? 80 + fit * 15 : 0
    case "voice_drop":
      return a.voice_drop_capable ? 78 + fit * 18 : a.mobile_phone ? 40 : 0
    case "sms":
      return a.sms_capable ? 68 + fit * 10 : 0
    case "calling":
      return a.phone ? 62 + fit * 12 : 0
    case "linkedin":
      return a.linkedin ? 45 + fit * 5 : 0
    default:
      return 20
  }
}

export function runMultiChannelOrchestrationEngine(
  input: ApolloMultichannelOrchestrationInput & { preferred_strategy_key?: string | null },
): ApolloMultichannelOrchestrationResult {
  const template = selectApolloMultichannelSequenceTemplate({
    availability: input.available_channels,
    preferred_strategy_key: input.preferred_strategy_key ?? null,
  })

  const channelScores = template.channel_order.map((channel) => ({
    channel,
    score: scoreChannelForOrchestration(channel, input),
  }))

  const reasoningParts: string[] = [template.recommendation_reason]

  if (input.company_intelligence_present) {
    reasoningParts.push("Company intelligence supports tailored multichannel sequencing.")
  }
  if (input.buying_committee_present) {
    reasoningParts.push("Buying committee coverage informs channel escalation pacing.")
  }
  if (input.engagement_history_present) {
    reasoningParts.push("Prior engagement history considered for cadence spacing.")
  }
  if (input.prior_outreach_count > 0) {
    reasoningParts.push(`${input.prior_outreach_count} prior outreach touch(es) — conservative spacing applied.`)
  }
  if (/director|vp|chief|owner|president/i.test(input.contact_role ?? "")) {
    reasoningParts.push("Senior contact role favors voice/call steps after email intro.")
  }

  const baseConfidence =
    input.channel_confidence * 0.35 +
    input.qualification_score * 0.35 +
    (input.fit_score ?? input.qualification_score) * 0.15 +
    (input.available_channels.voice_drop_capable ? 10 : 0) +
    (input.available_channels.verified_email ? 5 : 0)

  const penalty = input.prior_outreach_count >= 3 ? 10 : 0
  const confidence_score = Math.round(Math.min(100, Math.max(0, baseConfidence - penalty)) * 10) / 10

  return {
    recommended_sequence: template.sequence_label,
    channel_order: template.channel_order,
    confidence_score,
    reasoning: reasoningParts.join(" "),
  }
}
