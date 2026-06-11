/** Apollo Multi-Channel orchestration bridge — voice drop approval → sequence plan (no send). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  evaluateApolloMultichannelDuplicateBlock,
  mapApolloMultichannelSequenceCandidateDbRow,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-evidence"
import {
  APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
  type ApolloMultichannelOrchestrationActionResult,
  type ApolloMultichannelSequenceCandidateStatus,
  type ApolloMultichannelVoiceDropHandoffInput,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import { buildMultichannelOrchestrationPipelineFromVoiceDropHandoff } from "@/lib/growth/apollo/apollo-multichannel-orchestration-pipeline-builder"

export { buildMultichannelOrchestrationPipelineFromVoiceDropHandoff } from "@/lib/growth/apollo/apollo-multichannel-orchestration-pipeline-builder"

const TABLE = "apollo_multichannel_sequence_candidates"

function emptyResult(
  action: ApolloMultichannelOrchestrationActionResult["action"],
  error: string,
): ApolloMultichannelOrchestrationActionResult {
  return {
    ok: false,
    action,
    candidate_id: null,
    candidate_ids: [],
    status: null,
    error,
    outreach_sent: false,
    voice_drop_sent: false,
    draft_created: false,
    jobs_scheduled: false,
  }
}

export async function handoffVoiceDropApprovedToMultichannelOrchestration(
  admin: SupabaseClient,
  input: ApolloMultichannelVoiceDropHandoffInput,
): Promise<ApolloMultichannelOrchestrationActionResult> {
  const { data: existing } = await admin
    .schema("growth")
    .from(TABLE)
    .select("id, status")
    .eq("voice_drop_candidate_id", input.voice_drop_candidate_id)
    .in("status", ["pending_sequence_approval", "sequence_approved"])
    .limit(1)
    .maybeSingle()

  if (existing) {
    const duplicate = evaluateApolloMultichannelDuplicateBlock({
      existing_status: existing.status as ApolloMultichannelSequenceCandidateStatus,
    })
    if (duplicate.blocked) {
      return {
        ok: true,
        action: "create_from_voice_drop",
        candidate_id: typeof existing.id === "string" ? existing.id : null,
        candidate_ids: typeof existing.id === "string" ? [existing.id] : [],
        status: existing.status as ApolloMultichannelSequenceCandidateStatus,
        outreach_sent: false,
        voice_drop_sent: false,
        draft_created: false,
        jobs_scheduled: false,
      }
    }
  }

  const pipeline = buildMultichannelOrchestrationPipelineFromVoiceDropHandoff(input)
  const now = new Date().toISOString()

  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .insert({
      voice_drop_candidate_id: input.voice_drop_candidate_id,
      enrollment_candidate_id: input.enrollment_candidate_id,
      company_candidate_id: input.company_candidate_id,
      company_contact_id: input.company_contact_id,
      growth_lead_id: input.growth_lead_id,
      status: "pending_sequence_approval",
      qualification_score: input.qualification_score,
      fit_score: input.fit_score,
      orchestration_confidence: pipeline.orchestration_confidence,
      contact_snapshot: {
        full_name: input.full_name,
        title: input.title,
        company_name: input.company_name,
        email: input.email,
        phone: input.phone,
      },
      channel_availability: input.channel_availability,
      channel_intelligence: pipeline.channel_intelligence,
      orchestration_result: pipeline.orchestration_result,
      sequence_template: pipeline.sequence_template,
      scheduling_plan: pipeline.scheduling_plan,
      operator_summary: pipeline.operator_summary,
      source_attribution: pipeline.source_attribution,
      outreach_sent: false,
      voice_drop_sent: false,
      draft_created: false,
      jobs_scheduled: false,
      updated_at: now,
      metadata: {
        qa_marker: APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
        voice_drop_handoff_at: now,
      },
    })
    .select("*")
    .single()

  if (error || !data) {
    return emptyResult("create_from_voice_drop", error?.message ?? "sequence_candidate_insert_failed")
  }

  const candidateId = typeof data.id === "string" ? data.id : null
  logGrowthEngine("apollo_multichannel_sequence_candidate_created", {
    candidate_id: candidateId,
    voice_drop_candidate_id: input.voice_drop_candidate_id,
    sequence_key: pipeline.sequence_template.sequence_key,
    outreach_sent: false,
    jobs_scheduled: false,
  })

  return {
    ok: true,
    action: "create_from_voice_drop",
    candidate_id: candidateId,
    candidate_ids: candidateId ? [candidateId] : [],
    status: "pending_sequence_approval",
    outreach_sent: false,
    voice_drop_sent: false,
    draft_created: false,
    jobs_scheduled: false,
  }
}

export async function regenerateApolloMultichannelSequenceRecommendation(
  admin: SupabaseClient,
  input: { candidate_id: string },
): Promise<ApolloMultichannelOrchestrationActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .eq("id", input.candidate_id)
    .maybeSingle()

  if (error) return emptyResult("regenerate_recommendation", error.message)
  if (!data) return emptyResult("regenerate_recommendation", "candidate_not_found")

  const row = mapApolloMultichannelSequenceCandidateDbRow(data as Record<string, unknown>)
  const handoff: ApolloMultichannelVoiceDropHandoffInput = {
    voice_drop_candidate_id: row.voice_drop_candidate_id,
    enrollment_candidate_id: row.enrollment_candidate_id,
    company_candidate_id: row.company_candidate_id,
    company_contact_id: row.company_contact_id,
    growth_lead_id: row.growth_lead_id,
    company_name: row.company_name,
    full_name: row.full_name,
    title: row.title,
    email: row.email,
    phone: row.phone,
    qualification_score: row.qualification_score,
    fit_score: row.fit_score,
    voice_drop_score: null,
    channel_availability: row.channel_availability,
    channel_confidence: row.orchestration_confidence,
    multichannel_strategy_key: row.sequence_template.sequence_key,
    source_attribution: row.source_attribution as unknown as Record<string, unknown>,
    operator_intelligence: row.operator_summary as unknown as Record<string, unknown>,
  }

  const pipeline = buildMultichannelOrchestrationPipelineFromVoiceDropHandoff(handoff)
  const now = new Date().toISOString()

  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "pending_sequence_approval",
      orchestration_confidence: pipeline.orchestration_confidence,
      channel_intelligence: pipeline.channel_intelligence,
      orchestration_result: pipeline.orchestration_result,
      sequence_template: pipeline.sequence_template,
      scheduling_plan: pipeline.scheduling_plan,
      operator_summary: pipeline.operator_summary,
      updated_at: now,
      metadata: {
        qa_marker: APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
        recommendation_regenerated_at: now,
      },
    })
    .eq("id", input.candidate_id)

  if (updateError) return emptyResult("regenerate_recommendation", updateError.message)

  return {
    ok: true,
    action: "regenerate_recommendation",
    candidate_id: input.candidate_id,
    candidate_ids: [input.candidate_id],
    status: "pending_sequence_approval",
    outreach_sent: false,
    voice_drop_sent: false,
    draft_created: false,
    jobs_scheduled: false,
  }
}
