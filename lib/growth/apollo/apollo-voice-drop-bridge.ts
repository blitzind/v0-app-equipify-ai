/** Apollo Voice Drop bridge — enrollment approval → voice drop candidate (no send). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  evaluateApolloVoiceDropDuplicateBlock,
  mapApolloVoiceDropCandidateDbRow,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-evidence"
import type {
  ApolloVoiceDropAutomationActionResult,
  ApolloVoiceDropCandidateStatus,
  ApolloVoiceDropEnrollmentHandoffInput,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import { APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER } from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import { buildVoiceDropPipelineFromEnrollmentHandoff } from "@/lib/growth/apollo/apollo-voice-drop-pipeline-builder"

export { buildVoiceDropPipelineFromEnrollmentHandoff } from "@/lib/growth/apollo/apollo-voice-drop-pipeline-builder"

const TABLE = "apollo_voice_drop_candidates"

function emptyResult(
  action: ApolloVoiceDropAutomationActionResult["action"],
  error: string,
): ApolloVoiceDropAutomationActionResult {
  return {
    ok: false,
    action,
    candidate_id: null,
    candidate_ids: [],
    status: null,
    error,
    voice_drop_sent: false,
    outreach_sent: false,
    draft_created: false,
  }
}

export async function handoffEnrollmentApprovedToVoiceDropPipeline(
  admin: SupabaseClient,
  input: ApolloVoiceDropEnrollmentHandoffInput & { env?: NodeJS.ProcessEnv },
): Promise<ApolloVoiceDropAutomationActionResult> {
  const { data: existing } = await admin
    .schema("growth")
    .from(TABLE)
    .select("id, status")
    .eq("enrollment_candidate_id", input.enrollment_candidate_id)
    .in("status", ["pending_voice_drop_approval", "voice_drop_approved"])
    .limit(1)
    .maybeSingle()

  if (existing) {
    const duplicate = evaluateApolloVoiceDropDuplicateBlock({
      existing_status: existing.status as ApolloVoiceDropCandidateStatus,
    })
    if (duplicate.blocked) {
      return {
        ok: true,
        action: "create_from_enrollment",
        candidate_id: typeof existing.id === "string" ? existing.id : null,
        candidate_ids: typeof existing.id === "string" ? [existing.id] : [],
        status: existing.status as ApolloVoiceDropCandidateStatus,
        voice_drop_sent: false,
        outreach_sent: false,
        draft_created: false,
      }
    }
  }

  const pipeline = buildVoiceDropPipelineFromEnrollmentHandoff(input, input.env)
  const now = new Date().toISOString()

  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .insert({
      enrollment_candidate_id: input.enrollment_candidate_id,
      company_candidate_id: input.company_candidate_id,
      company_contact_id: input.company_contact_id,
      contact_candidate_id: input.contact_candidate_id,
      growth_lead_id: input.growth_lead_id,
      status: "pending_voice_drop_approval",
      qualification_score: input.qualification_score,
      voice_drop_score: pipeline.voiceDropScore,
      recommendation_confidence: pipeline.channelRecommendations.confidence_score,
      contact_snapshot: {
        full_name: input.full_name,
        title: input.title,
        company_name: input.company_name,
        email: input.email,
        phone: input.phone,
      },
      channel_evaluation: pipeline.availability,
      channel_recommendations: pipeline.channelRecommendations,
      multichannel_strategy: pipeline.multichannelStrategy,
      voice_drop_intelligence: pipeline.voiceDropIntelligence,
      voice_drop_script: pipeline.voiceDropScript,
      source_attribution: pipeline.sourceAttribution,
      voice_drop_sent: false,
      outreach_sent: false,
      draft_created: false,
      updated_at: now,
      metadata: {
        qa_marker: APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER,
        enrollment_handoff_at: now,
      },
    })
    .select("*")
    .single()

  if (error || !data) {
    return emptyResult("create_from_enrollment", error?.message ?? "voice_drop_candidate_insert_failed")
  }

  const candidateId = typeof data.id === "string" ? data.id : null
  logGrowthEngine("apollo_voice_drop_candidate_created", {
    candidate_id: candidateId,
    enrollment_candidate_id: input.enrollment_candidate_id,
    voice_drop_score: pipeline.voiceDropScore,
    voice_drop_sent: false,
    outreach_sent: false,
    draft_created: false,
  })

  return {
    ok: true,
    action: "create_from_enrollment",
    candidate_id: candidateId,
    candidate_ids: candidateId ? [candidateId] : [],
    status: "pending_voice_drop_approval",
    voice_drop_sent: false,
    outreach_sent: false,
    draft_created: false,
  }
}

export async function regenerateApolloVoiceDropCandidateIntelligence(
  admin: SupabaseClient,
  input: {
    candidate_id: string
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloVoiceDropAutomationActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .eq("id", input.candidate_id)
    .maybeSingle()

  if (error) return emptyResult("rerun_intelligence", error.message)
  if (!data) return emptyResult("rerun_intelligence", "candidate_not_found")

  const row = mapApolloVoiceDropCandidateDbRow(data as Record<string, unknown>)
  const handoff: ApolloVoiceDropEnrollmentHandoffInput = {
    enrollment_candidate_id: row.enrollment_candidate_id,
    company_candidate_id: row.company_candidate_id,
    company_contact_id: row.company_contact_id,
    contact_candidate_id: row.contact_candidate_id,
    growth_lead_id: row.growth_lead_id,
    company_name: row.company_name,
    full_name: row.full_name,
    title: row.title,
    email: row.email,
    phone: row.phone,
    qualification_score: row.qualification_score,
    fit_score: null,
    research_score: null,
    operator_intelligence: row.voice_drop_intelligence as unknown as Record<string, unknown>,
    source_attribution: row.source_attribution as unknown as Record<string, unknown>,
    acquisition_evidence: {},
  }

  const pipeline = buildVoiceDropPipelineFromEnrollmentHandoff(handoff, input.env)
  const now = new Date().toISOString()

  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "pending_voice_drop_approval",
      voice_drop_score: pipeline.voiceDropScore,
      recommendation_confidence: pipeline.channelRecommendations.confidence_score,
      channel_evaluation: pipeline.availability,
      channel_recommendations: pipeline.channelRecommendations,
      multichannel_strategy: pipeline.multichannelStrategy,
      voice_drop_intelligence: pipeline.voiceDropIntelligence,
      voice_drop_script: pipeline.voiceDropScript,
      updated_at: now,
      metadata: {
        qa_marker: APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER,
        intelligence_rerun_at: now,
      },
    })
    .eq("id", input.candidate_id)

  if (updateError) return emptyResult("rerun_intelligence", updateError.message)

  return {
    ok: true,
    action: "rerun_intelligence",
    candidate_id: input.candidate_id,
    candidate_ids: [input.candidate_id],
    status: "pending_voice_drop_approval",
    voice_drop_sent: false,
    outreach_sent: false,
    draft_created: false,
  }
}
