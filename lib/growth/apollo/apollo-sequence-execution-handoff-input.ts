/** Apollo Sequence Execution handoff input builder — client-safe. */

import type { ApolloMultichannelSequenceCandidateRow } from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import type { ApolloSequenceExecutionMultichannelHandoffInput } from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function buildApolloSequenceExecutionHandoffInput(input: {
  multichannel: ApolloMultichannelSequenceCandidateRow
  growth_lead_id?: string | null
  voice_drop_script_reference?: string | null
  created_by_user_id?: string | null
}): ApolloSequenceExecutionMultichannelHandoffInput & { created_by_user_id?: string | null } {
  const growthLeadId = input.growth_lead_id?.trim() || input.multichannel.growth_lead_id?.trim() || null

  return {
    multichannel_sequence_candidate_id: input.multichannel.candidate_id,
    voice_drop_candidate_id: input.multichannel.voice_drop_candidate_id,
    enrollment_candidate_id: input.multichannel.enrollment_candidate_id,
    company_candidate_id: input.multichannel.company_candidate_id,
    company_contact_id: input.multichannel.company_contact_id,
    growth_lead_id: growthLeadId,
    company_name: asString(input.multichannel.company_name) || "Unknown",
    full_name: asString(input.multichannel.full_name) || "Unknown",
    title: asString(input.multichannel.title) || null,
    email: asString(input.multichannel.email) || null,
    phone: asString(input.multichannel.phone) || null,
    qualification_score: input.multichannel.qualification_score,
    sequence_key: asString(input.multichannel.sequence_template.sequence_key) || "pending",
    sequence_label: asString(input.multichannel.sequence_template.sequence_label) || "Pending",
    channel_order: input.multichannel.orchestration_result.channel_order,
    scheduling_plan: input.multichannel.scheduling_plan,
    voice_drop_script_reference: input.voice_drop_script_reference ?? null,
    source_attribution: input.multichannel.source_attribution as unknown as Record<string, unknown>,
    created_by_user_id: input.created_by_user_id ?? null,
  }
}
