/** Apollo Sequence Execution queue — server-only draft approval, no send. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  approveAllApolloSequenceExecutionDrafts,
  buildApolloSequenceExecutionQueueSnapshot,
  evaluateApolloSequenceExecutionDraftApprovalGate,
  mapApolloSequenceExecutionCandidateDbRow,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-evidence"
import {
  APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
  type ApolloSequenceExecutionAutomationActionResult,
  type ApolloSequenceExecutionCandidateStatus,
  type ApolloSequenceExecutionQueueSnapshot,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import { regenerateApolloSequenceExecutionDrafts } from "@/lib/growth/apollo/apollo-sequence-execution-bridge"

export {
  APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
  type ApolloSequenceExecutionQueueSnapshot,
  type ApolloSequenceExecutionAutomationActionResult,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"

const TABLE = "apollo_sequence_execution_candidates"

function emptyResult(
  action: ApolloSequenceExecutionAutomationActionResult["action"],
  error: string,
): ApolloSequenceExecutionAutomationActionResult {
  return {
    ok: false,
    action,
    candidate_id: null,
    candidate_ids: [],
    status: null,
    error,
    outreach_sent: false,
    voice_drop_sent: false,
    email_sent: false,
    sms_sent: false,
    call_placed: false,
    draft_created: true,
    jobs_scheduled: false,
  }
}

export async function loadApolloSequenceExecutionQueue(
  admin: SupabaseClient,
  input?: {
    company_candidate_id?: string | null
    multichannel_sequence_candidate_id?: string | null
    status?: ApolloSequenceExecutionCandidateStatus | "all"
    limit?: number
  },
): Promise<ApolloSequenceExecutionQueueSnapshot> {
  let query = admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 100)

  if (input?.company_candidate_id?.trim()) {
    query = query.eq("company_candidate_id", input.company_candidate_id.trim())
  }
  if (input?.multichannel_sequence_candidate_id?.trim()) {
    query = query.eq(
      "multichannel_sequence_candidate_id",
      input.multichannel_sequence_candidate_id.trim(),
    )
  }

  const status = input?.status ?? "all"
  if (status !== "all") {
    query = query.eq("status", status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const items = ((data ?? []) as Record<string, unknown>[]).map(
    mapApolloSequenceExecutionCandidateDbRow,
  )
  return buildApolloSequenceExecutionQueueSnapshot({ items })
}

export async function approveApolloSequenceExecutionDrafts(
  admin: SupabaseClient,
  input: {
    candidate_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<ApolloSequenceExecutionAutomationActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .eq("id", input.candidate_id)
    .maybeSingle()

  if (error) return emptyResult("approve_draft", error.message)
  if (!data) return emptyResult("approve_draft", "candidate_not_found")

  const candidate = mapApolloSequenceExecutionCandidateDbRow(data as Record<string, unknown>)
  const gate = evaluateApolloSequenceExecutionDraftApprovalGate({ candidate })
  if (!gate.allowed) {
    return emptyResult("approve_draft", gate.code ?? "approval_blocked")
  }

  const approvedDrafts = approveAllApolloSequenceExecutionDrafts(candidate.materialization.drafts)
  const approvedSteps = candidate.materialization.steps.map((step) => ({
    ...step,
    approval_status: "draft_approved" as const,
  }))
  const materialization = {
    ...candidate.materialization,
    steps: approvedSteps,
    drafts: approvedDrafts,
  }
  const now = new Date().toISOString()

  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "execution_ready",
      sequence_materialization: materialization,
      draft_records: approvedDrafts,
      sequence_steps: approvedSteps,
      drafts_approved_at: now,
      drafts_approved_by: input.approver_user_id ?? null,
      drafts_approved_email: input.approver_email ?? null,
      outreach_sent: false,
      voice_drop_sent: false,
      email_sent: false,
      sms_sent: false,
      call_placed: false,
      draft_created: true,
      jobs_scheduled: false,
      updated_at: now,
      metadata: {
        qa_marker: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
        draft_approval_note: input.note?.trim() || null,
      },
    })
    .eq("id", input.candidate_id)

  if (updateError) return emptyResult("approve_draft", updateError.message)

  return {
    ok: true,
    action: "approve_draft",
    candidate_id: input.candidate_id,
    candidate_ids: [input.candidate_id],
    status: "execution_ready",
    outreach_sent: false,
    voice_drop_sent: false,
    email_sent: false,
    sms_sent: false,
    call_placed: false,
    draft_created: true,
    jobs_scheduled: false,
  }
}

export async function rejectApolloSequenceExecutionDrafts(
  admin: SupabaseClient,
  input: {
    candidate_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<ApolloSequenceExecutionAutomationActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("id, status")
    .eq("id", input.candidate_id)
    .maybeSingle()

  if (error) return emptyResult("reject_draft", error.message)
  if (!data) return emptyResult("reject_draft", "candidate_not_found")
  if (data.status !== "pending_draft_approval") {
    return emptyResult("reject_draft", "invalid_candidate_status")
  }

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "draft_rejected",
      drafts_approved_by: input.approver_user_id ?? null,
      drafts_approved_email: input.approver_email ?? null,
      draft_rejection_note: input.note?.trim() || null,
      outreach_sent: false,
      voice_drop_sent: false,
      email_sent: false,
      sms_sent: false,
      call_placed: false,
      draft_created: true,
      jobs_scheduled: false,
      updated_at: now,
      metadata: { qa_marker: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER },
    })
    .eq("id", input.candidate_id)

  if (updateError) return emptyResult("reject_draft", updateError.message)

  return {
    ok: true,
    action: "reject_draft",
    candidate_id: input.candidate_id,
    candidate_ids: [input.candidate_id],
    status: "draft_rejected",
    outreach_sent: false,
    voice_drop_sent: false,
    email_sent: false,
    sms_sent: false,
    call_placed: false,
    draft_created: true,
    jobs_scheduled: false,
  }
}

export { regenerateApolloSequenceExecutionDrafts }
