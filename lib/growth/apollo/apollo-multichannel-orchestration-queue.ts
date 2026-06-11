/** Apollo Multi-Channel orchestration queue — server-only, plan approval only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeGrowthActorUserIdForDb } from "@/lib/growth/actor-user-id"
import {
  buildApolloMultichannelSequenceQueueSnapshot,
  evaluateApolloMultichannelSequenceApprovalGate,
  mapApolloMultichannelSequenceCandidateDbRow,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-evidence"
import {
  APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
  type ApolloMultichannelOrchestrationActionResult,
  type ApolloMultichannelSequenceCandidateStatus,
  type ApolloMultichannelSequenceQueueSnapshot,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import { regenerateApolloMultichannelSequenceRecommendation } from "@/lib/growth/apollo/apollo-multichannel-orchestration-bridge"
import { handoffMultichannelApprovedToSequenceExecution } from "@/lib/growth/apollo/apollo-sequence-execution-bridge"
import { mapApolloVoiceDropCandidateDbRow } from "@/lib/growth/apollo/apollo-voice-drop-automation-evidence"

export {
  APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
  type ApolloMultichannelSequenceQueueSnapshot,
  type ApolloMultichannelOrchestrationActionResult,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"

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

export async function loadApolloMultichannelSequenceQueue(
  admin: SupabaseClient,
  input?: {
    company_candidate_id?: string | null
    voice_drop_candidate_id?: string | null
    status?: ApolloMultichannelSequenceCandidateStatus | "all"
    limit?: number
  },
): Promise<ApolloMultichannelSequenceQueueSnapshot> {
  let query = admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 100)

  if (input?.company_candidate_id?.trim()) {
    query = query.eq("company_candidate_id", input.company_candidate_id.trim())
  }
  if (input?.voice_drop_candidate_id?.trim()) {
    query = query.eq("voice_drop_candidate_id", input.voice_drop_candidate_id.trim())
  }

  const status = input?.status ?? "all"
  if (status !== "all") {
    query = query.eq("status", status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const items = ((data ?? []) as Record<string, unknown>[]).map(
    mapApolloMultichannelSequenceCandidateDbRow,
  )
  return buildApolloMultichannelSequenceQueueSnapshot({ items })
}

export async function approveApolloMultichannelSequenceCandidate(
  admin: SupabaseClient,
  input: {
    candidate_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<ApolloMultichannelOrchestrationActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .eq("id", input.candidate_id)
    .maybeSingle()

  if (error) return emptyResult("approve_sequence", error.message)
  if (!data) return emptyResult("approve_sequence", "candidate_not_found")

  const candidate = mapApolloMultichannelSequenceCandidateDbRow(data as Record<string, unknown>)
  const gate = evaluateApolloMultichannelSequenceApprovalGate({ candidate })
  if (!gate.allowed) {
    return emptyResult("approve_sequence", gate.code ?? "approval_blocked")
  }

  const now = new Date().toISOString()
  const approverUserId = normalizeGrowthActorUserIdForDb(input.approver_user_id)
  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "sequence_approved",
      sequence_approved_at: now,
      sequence_approved_by: approverUserId,
      sequence_approved_email: input.approver_email ?? null,
      outreach_sent: false,
      voice_drop_sent: false,
      draft_created: false,
      jobs_scheduled: false,
      updated_at: now,
      metadata: {
        qa_marker: APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
        sequence_approval_note: input.note?.trim() || null,
      },
    })
    .eq("id", input.candidate_id)

  if (updateError) return emptyResult("approve_sequence", updateError.message)

  const { data: voiceDropRow } = await admin
    .schema("growth")
    .from("apollo_voice_drop_candidates")
    .select("*")
    .eq("id", candidate.voice_drop_candidate_id)
    .maybeSingle()

  const voiceDrop = voiceDropRow
    ? mapApolloVoiceDropCandidateDbRow(voiceDropRow as Record<string, unknown>)
    : null

  await handoffMultichannelApprovedToSequenceExecution(admin, {
    multichannel_sequence_candidate_id: candidate.candidate_id,
    voice_drop_candidate_id: candidate.voice_drop_candidate_id,
    enrollment_candidate_id: candidate.enrollment_candidate_id,
    company_candidate_id: candidate.company_candidate_id,
    company_contact_id: candidate.company_contact_id,
    growth_lead_id: candidate.growth_lead_id,
    company_name: candidate.company_name,
    full_name: candidate.full_name,
    title: candidate.title,
    email: candidate.email,
    phone: candidate.phone,
    qualification_score: candidate.qualification_score,
    sequence_key: candidate.sequence_template.sequence_key,
    sequence_label: candidate.sequence_template.sequence_label,
    channel_order: candidate.orchestration_result.channel_order,
    scheduling_plan: candidate.scheduling_plan,
    voice_drop_script_reference: voiceDrop?.voice_drop_script.full_script ?? null,
    source_attribution: candidate.source_attribution as unknown as Record<string, unknown>,
  })

  return {
    ok: true,
    action: "approve_sequence",
    candidate_id: input.candidate_id,
    candidate_ids: [input.candidate_id],
    status: "sequence_approved",
    outreach_sent: false,
    voice_drop_sent: false,
    draft_created: false,
    jobs_scheduled: false,
  }
}

export async function rejectApolloMultichannelSequenceCandidate(
  admin: SupabaseClient,
  input: {
    candidate_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<ApolloMultichannelOrchestrationActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("id, status")
    .eq("id", input.candidate_id)
    .maybeSingle()

  if (error) return emptyResult("reject_sequence", error.message)
  if (!data) return emptyResult("reject_sequence", "candidate_not_found")
  if (data.status !== "pending_sequence_approval") {
    return emptyResult("reject_sequence", "invalid_candidate_status")
  }

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "sequence_rejected",
      sequence_approved_by: input.approver_user_id ?? null,
      sequence_approved_email: input.approver_email ?? null,
      sequence_rejection_note: input.note?.trim() || null,
      outreach_sent: false,
      voice_drop_sent: false,
      draft_created: false,
      jobs_scheduled: false,
      updated_at: now,
      metadata: { qa_marker: APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER },
    })
    .eq("id", input.candidate_id)

  if (updateError) return emptyResult("reject_sequence", updateError.message)

  return {
    ok: true,
    action: "reject_sequence",
    candidate_id: input.candidate_id,
    candidate_ids: [input.candidate_id],
    status: "sequence_rejected",
    outreach_sent: false,
    voice_drop_sent: false,
    draft_created: false,
    jobs_scheduled: false,
  }
}

export { regenerateApolloMultichannelSequenceRecommendation }
