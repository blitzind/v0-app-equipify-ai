/** Apollo Voice Drop bridge — account playbook approval → voice drop candidate (no send). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type { ApolloAccountPlaybookVoiceDropHandoffInput } from "@/lib/growth/apollo/apollo-account-playbooks-types"
import {
  buildApolloVoiceDropAttributionRecord,
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

function enrichOperatorIntelligenceFromPlaybook(
  input: ApolloAccountPlaybookVoiceDropHandoffInput,
): Record<string, unknown> {
  const base = { ...input.operator_intelligence }
  const playbook = input.playbook_result
  return {
    ...base,
    account_playbook_key: playbook.playbook_key,
    committee_strategy: playbook.committee_strategy,
    committee_coverage_score: playbook.committee_coverage_score,
    coverage_status: playbook.coverage_status,
    buying_committee_summary: `${playbook.committee_role_summary.length} committee member(s); coverage ${playbook.coverage_status} (${playbook.committee_coverage_score}/100).`,
    recommended_messaging_theme: playbook.recommended_messaging_theme,
    recommended_channel_mix: playbook.recommended_channel_mix,
  }
}

async function insertVoiceDropCandidate(
  admin: SupabaseClient,
  input: {
    enrollment_candidate_id: string
    account_playbook_id?: string | null
    company_candidate_id: string
    company_contact_id: string | null
    contact_candidate_id: string | null
    growth_lead_id: string | null
    qualification_score: number
    handoff: ApolloVoiceDropEnrollmentHandoffInput
    env?: NodeJS.ProcessEnv
    handoff_source: "enrollment" | "account_playbook"
  },
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

  const pipeline = buildVoiceDropPipelineFromEnrollmentHandoff(input.handoff, input.env)
  const now = new Date().toISOString()

  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .insert({
      enrollment_candidate_id: input.enrollment_candidate_id,
      account_playbook_id: input.account_playbook_id ?? null,
      company_candidate_id: input.company_candidate_id,
      company_contact_id: input.company_contact_id,
      contact_candidate_id: input.contact_candidate_id,
      growth_lead_id: input.growth_lead_id,
      status: "pending_voice_drop_approval",
      qualification_score: input.qualification_score,
      voice_drop_score: pipeline.voiceDropScore,
      recommendation_confidence: pipeline.channelRecommendations.confidence_score,
      contact_snapshot: {
        full_name: input.handoff.full_name,
        title: input.handoff.title,
        company_name: input.handoff.company_name,
        email: input.handoff.email,
        phone: input.handoff.phone,
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
        handoff_source: input.handoff_source,
        handoff_at: now,
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
    account_playbook_id: input.account_playbook_id ?? null,
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

/** @deprecated Use handoffAccountPlaybookApprovedToVoiceDropPipeline after ABP-1 enrollment handoff. */
export async function handoffEnrollmentApprovedToVoiceDropPipeline(
  admin: SupabaseClient,
  input: ApolloVoiceDropEnrollmentHandoffInput & { env?: NodeJS.ProcessEnv },
): Promise<ApolloVoiceDropAutomationActionResult> {
  return insertVoiceDropCandidate(admin, {
    enrollment_candidate_id: input.enrollment_candidate_id,
    company_candidate_id: input.company_candidate_id,
    company_contact_id: input.company_contact_id,
    contact_candidate_id: input.contact_candidate_id,
    growth_lead_id: input.growth_lead_id,
    qualification_score: input.qualification_score,
    handoff: input,
    env: input.env,
    handoff_source: "enrollment",
  })
}

export async function handoffAccountPlaybookApprovedToVoiceDropPipeline(
  admin: SupabaseClient,
  input: ApolloAccountPlaybookVoiceDropHandoffInput & { env?: NodeJS.ProcessEnv },
): Promise<ApolloVoiceDropAutomationActionResult> {
  const enrichedOperatorIntelligence = enrichOperatorIntelligenceFromPlaybook(input)
  const voiceDropAttribution = buildApolloVoiceDropAttributionRecord(
    input.source_attribution as unknown as Record<string, unknown>,
  )

  return insertVoiceDropCandidate(admin, {
    enrollment_candidate_id: input.enrollment_candidate_id,
    account_playbook_id: input.account_playbook_id,
    company_candidate_id: input.company_candidate_id,
    company_contact_id: input.company_contact_id,
    contact_candidate_id: input.contact_candidate_id,
    growth_lead_id: input.growth_lead_id,
    qualification_score: input.qualification_score,
    handoff: {
      enrollment_candidate_id: input.enrollment_candidate_id,
      company_candidate_id: input.company_candidate_id,
      company_contact_id: input.company_contact_id,
      contact_candidate_id: input.contact_candidate_id,
      growth_lead_id: input.growth_lead_id,
      company_name: input.company_name,
      full_name: input.full_name,
      title: input.title,
      email: input.email,
      phone: input.phone,
      qualification_score: input.qualification_score,
      fit_score: input.fit_score,
      research_score: input.research_score,
      operator_intelligence: enrichedOperatorIntelligence,
      source_attribution: voiceDropAttribution as unknown as Record<string, unknown>,
      acquisition_evidence: input.acquisition_evidence,
    },
    env: input.env,
    handoff_source: "account_playbook",
  })
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
