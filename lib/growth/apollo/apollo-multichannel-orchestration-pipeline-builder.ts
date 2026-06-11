/** Apollo Multi-Channel orchestration pipeline builder — client-safe. */

import { buildApolloMultichannelAttributionRecord } from "@/lib/growth/apollo/apollo-multichannel-orchestration-evidence"
import type { ApolloMultichannelVoiceDropHandoffInput } from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import { buildApolloMultichannelChannelIntelligence } from "@/lib/growth/apollo/apollo-multichannel-channel-intelligence"
import { runMultiChannelOrchestrationEngine } from "@/lib/growth/apollo/apollo-multichannel-orchestration-engine"
import {
  buildApolloMultichannelSchedulingPlan,
  formatSchedulingPlanSummary,
} from "@/lib/growth/apollo/apollo-multichannel-scheduling-layer"
import { selectApolloMultichannelSequenceTemplate } from "@/lib/growth/apollo/apollo-multichannel-sequence-templates"

export const APOLLO_MULTICHANNEL_ORCHESTRATION_PIPELINE_QA_MARKER =
  "apollo-multichannel-orchestration-pipeline-v1" as const

function strategyKeyFromMultichannel(input: ApolloMultichannelVoiceDropHandoffInput): string | null {
  const key = input.multichannel_strategy_key?.trim()
  if (!key) return null
  return key.replace(/-/g, "_")
}

export function buildMultichannelOrchestrationPipelineFromVoiceDropHandoff(
  input: ApolloMultichannelVoiceDropHandoffInput,
) {
  const orchestrationInput = {
    qualification_score: input.qualification_score,
    fit_score: input.fit_score,
    contact_role: input.title,
    company_intelligence_present: Boolean(
      typeof input.operator_intelligence.company_summary === "string" &&
        input.operator_intelligence.company_summary.trim(),
    ),
    buying_committee_present: Boolean(
      typeof input.operator_intelligence.buying_committee_summary === "string" &&
        input.operator_intelligence.buying_committee_summary.includes("committee"),
    ),
    available_channels: input.channel_availability,
    channel_confidence: input.channel_confidence,
    engagement_history_present: input.engagement_history_present === true,
    prior_outreach_count: input.prior_outreach_count ?? 0,
    voice_drop_score: input.voice_drop_score,
    preferred_strategy_key: strategyKeyFromMultichannel(input),
  }

  const orchestration_result = runMultiChannelOrchestrationEngine(orchestrationInput)
  const sequence_template = selectApolloMultichannelSequenceTemplate({
    availability: input.channel_availability,
    preferred_strategy_key: orchestrationInput.preferred_strategy_key,
  })
  const scheduling_plan = buildApolloMultichannelSchedulingPlan({
    channel_order: orchestration_result.channel_order,
    prior_outreach_count: orchestrationInput.prior_outreach_count,
  })
  const channel_intelligence = buildApolloMultichannelChannelIntelligence({
    availability: input.channel_availability,
    channel_order: orchestration_result.channel_order,
    prior_outreach_count: orchestrationInput.prior_outreach_count,
  })
  const source_attribution = buildApolloMultichannelAttributionRecord(input.source_attribution)

  const operator_summary = {
    why_selected: orchestration_result.reasoning,
    recommended_sequence: orchestration_result.recommended_sequence,
    confidence: orchestration_result.confidence_score,
    channel_availability_summary: [
      input.channel_availability.verified_email ? "email" : null,
      input.channel_availability.voice_drop_capable ? "voice_drop" : null,
      input.channel_availability.sms_capable ? "sms" : null,
      input.channel_availability.phone ? "calling" : null,
    ]
      .filter(Boolean)
      .join(", ") || "limited channels",
    scheduling_summary: formatSchedulingPlanSummary(scheduling_plan),
  }

  return {
    orchestration_result,
    sequence_template,
    scheduling_plan,
    channel_intelligence,
    source_attribution,
    operator_summary,
    orchestration_confidence: orchestration_result.confidence_score,
  }
}
