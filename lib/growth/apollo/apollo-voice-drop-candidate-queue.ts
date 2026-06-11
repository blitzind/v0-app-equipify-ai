/** Apollo Voice Drop candidate queue — server-only actions, no send. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeGrowthActorUserIdForDb } from "@/lib/growth/actor-user-id"
import {
  buildApolloVoiceDropCandidateQueueSnapshot,
  evaluateApolloVoiceDropApprovalGate,
  mapApolloVoiceDropCandidateDbRow,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-evidence"
import {
  APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER,
  type ApolloVoiceDropAutomationActionResult,
  type ApolloVoiceDropCandidateQueueSnapshot,
  type ApolloVoiceDropCandidateStatus,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import { regenerateApolloVoiceDropCandidateIntelligence } from "@/lib/growth/apollo/apollo-voice-drop-bridge"
import { handoffVoiceDropApprovedToMultichannelOrchestration } from "@/lib/growth/apollo/apollo-multichannel-orchestration-bridge"
import { loadApolloQueueRows, paginateMappedApolloQueueRows } from "@/lib/growth/apollo/apollo-queue-loader"
import type { ApolloQueuePaginationInput } from "@/lib/growth/apollo/apollo-queue-pagination"

export {
  APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER,
  type ApolloVoiceDropCandidateQueueSnapshot,
  type ApolloVoiceDropAutomationActionResult,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-types"

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

export async function loadApolloVoiceDropCandidateQueue(
  admin: SupabaseClient,
  input?: {
    company_candidate_id?: string | null
    enrollment_candidate_id?: string | null
    status?: ApolloVoiceDropCandidateStatus | "all"
    limit?: number
    pagination?: ApolloQueuePaginationInput
  },
): Promise<ApolloVoiceDropCandidateQueueSnapshot> {
  const rows = await loadApolloQueueRows(admin, {
    table: TABLE,
    company_candidate_id: input?.company_candidate_id ?? null,
    status: input?.status ?? "all",
    scanLimit: input?.limit ?? undefined,
    extraFilters: input?.enrollment_candidate_id?.trim()
      ? [{ column: "enrollment_candidate_id", value: input.enrollment_candidate_id.trim() }]
      : [],
  })

  const mapped = rows.map(mapApolloVoiceDropCandidateDbRow)
  const paged = paginateMappedApolloQueueRows(mapped, input?.pagination)
  return buildApolloVoiceDropCandidateQueueSnapshot({
    items: paged.items,
    pagination: paged.pagination,
  })
}

export async function approveApolloVoiceDropCandidate(
  admin: SupabaseClient,
  input: {
    candidate_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<ApolloVoiceDropAutomationActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .eq("id", input.candidate_id)
    .maybeSingle()

  if (error) return emptyResult("approve_voice_drop", error.message)
  if (!data) return emptyResult("approve_voice_drop", "candidate_not_found")

  const candidate = mapApolloVoiceDropCandidateDbRow(data as Record<string, unknown>)
  const gate = evaluateApolloVoiceDropApprovalGate({ candidate })
  if (!gate.allowed) {
    return emptyResult("approve_voice_drop", gate.code ?? "approval_blocked")
  }

  const now = new Date().toISOString()
  const approverUserId = normalizeGrowthActorUserIdForDb(input.approver_user_id)
  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "voice_drop_approved",
      voice_drop_approved_at: now,
      voice_drop_approved_by: approverUserId,
      voice_drop_approved_email: input.approver_email ?? null,
      voice_drop_sent: false,
      outreach_sent: false,
      draft_created: false,
      updated_at: now,
      metadata: {
        qa_marker: APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER,
        voice_drop_approval_note: input.note?.trim() || null,
      },
    })
    .eq("id", input.candidate_id)

  if (updateError) return emptyResult("approve_voice_drop", updateError.message)

  await handoffVoiceDropApprovedToMultichannelOrchestration(admin, {
    voice_drop_candidate_id: candidate.candidate_id,
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
    fit_score: null,
    voice_drop_score: candidate.voice_drop_score,
    channel_availability: candidate.channel_availability,
    channel_confidence: candidate.recommendation_confidence,
    multichannel_strategy_key: candidate.multichannel_strategy.strategy_key,
    source_attribution: candidate.source_attribution as unknown as Record<string, unknown>,
    operator_intelligence: {
      company_summary: candidate.voice_drop_intelligence.intelligence_summary,
      buying_committee_summary: candidate.channel_recommendations.recommended_sequence_strategy,
    },
  })

  return {
    ok: true,
    action: "approve_voice_drop",
    candidate_id: input.candidate_id,
    candidate_ids: [input.candidate_id],
    status: "voice_drop_approved",
    voice_drop_sent: false,
    outreach_sent: false,
    draft_created: false,
  }
}

export async function rejectApolloVoiceDropCandidate(
  admin: SupabaseClient,
  input: {
    candidate_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<ApolloVoiceDropAutomationActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("id, status")
    .eq("id", input.candidate_id)
    .maybeSingle()

  if (error) return emptyResult("reject_voice_drop", error.message)
  if (!data) return emptyResult("reject_voice_drop", "candidate_not_found")

  if (data.status !== "pending_voice_drop_approval") {
    return emptyResult("reject_voice_drop", "invalid_candidate_status")
  }

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "voice_drop_rejected",
      voice_drop_approved_by: input.approver_user_id ?? null,
      voice_drop_approved_email: input.approver_email ?? null,
      voice_drop_rejection_note: input.note?.trim() || null,
      voice_drop_sent: false,
      outreach_sent: false,
      draft_created: false,
      updated_at: now,
      metadata: { qa_marker: APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER },
    })
    .eq("id", input.candidate_id)

  if (updateError) return emptyResult("reject_voice_drop", updateError.message)

  return {
    ok: true,
    action: "reject_voice_drop",
    candidate_id: input.candidate_id,
    candidate_ids: [input.candidate_id],
    status: "voice_drop_rejected",
    voice_drop_sent: false,
    outreach_sent: false,
    draft_created: false,
  }
}

export { regenerateApolloVoiceDropCandidateIntelligence }
