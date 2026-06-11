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
import { loadApolloQueueRows, paginateMappedApolloQueueRows } from "@/lib/growth/apollo/apollo-queue-loader"
import type { ApolloQueuePaginationInput } from "@/lib/growth/apollo/apollo-queue-pagination"
import { skipApolloSequenceExecutionJobsForDraftReject } from "@/lib/growth/apollo/apollo-sequence-execution-job-gate-server"
import { personalizeApolloSequenceCandidateContent } from "@/lib/growth/apollo/apollo-sequence-personalization-service"

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

function mergeCandidateMetadata(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...(existing && typeof existing === "object" ? existing : {}),
    ...patch,
  }
}

export async function loadApolloSequenceExecutionQueue(
  admin: SupabaseClient,
  input?: {
    company_candidate_id?: string | null
    multichannel_sequence_candidate_id?: string | null
    status?: ApolloSequenceExecutionCandidateStatus | "all"
    limit?: number
    pagination?: ApolloQueuePaginationInput
  },
): Promise<ApolloSequenceExecutionQueueSnapshot> {
  const rows = await loadApolloQueueRows(admin, {
    table: TABLE,
    company_candidate_id: input?.company_candidate_id ?? null,
    status: input?.status ?? "all",
    scanLimit: input?.limit ?? undefined,
    extraFilters: input?.multichannel_sequence_candidate_id?.trim()
      ? [
          {
            column: "multichannel_sequence_candidate_id",
            value: input.multichannel_sequence_candidate_id.trim(),
          },
        ]
      : [],
  })

  const mapped = rows.map(mapApolloSequenceExecutionCandidateDbRow)
  const paged = paginateMappedApolloQueueRows(mapped, input?.pagination)
  return buildApolloSequenceExecutionQueueSnapshot({
    items: paged.items,
    pagination: paged.pagination,
  })
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

  const personalization = await personalizeApolloSequenceCandidateContent(admin, {
    candidate,
    acting_user_id: input.approver_user_id?.trim() || "system",
    acting_user_email: input.approver_email?.trim() || "system",
  })
  if (!personalization.ok) {
    return emptyResult(
      "approve_draft",
      `${personalization.code ?? "content_not_ready"}: ${personalization.detail ?? "Personalization incomplete."}`,
    )
  }

  const personalizedCandidate = {
    ...candidate,
    materialization: personalization.materialization,
    execution_jobs: personalization.execution_jobs,
  }

  const approvedDrafts = approveAllApolloSequenceExecutionDrafts(personalizedCandidate.materialization.drafts)
  const approvedSteps = personalizedCandidate.materialization.steps.map((step) => ({
    ...step,
    approval_status: "draft_approved" as const,
  }))
  const materialization = {
    ...personalizedCandidate.materialization,
    steps: approvedSteps,
    drafts: approvedDrafts,
  }
  const now = new Date().toISOString()
  const existingMetadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {}

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
      execution_jobs: personalizedCandidate.execution_jobs,
      metadata: mergeCandidateMetadata(existingMetadata, {
        qa_marker: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
        draft_approval_note: input.note?.trim() || null,
        draft_approved_at: now,
        personalization_packet_marker: personalization.unified_context?.qa_marker ?? null,
        content_readiness_detail: personalization.readiness.detail,
      }),
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
    .select("*")
    .eq("id", input.candidate_id)
    .maybeSingle()

  if (error) return emptyResult("reject_draft", error.message)
  if (!data) return emptyResult("reject_draft", "candidate_not_found")
  if (data.status !== "pending_draft_approval") {
    return emptyResult("reject_draft", "invalid_candidate_status")
  }

  const candidate = mapApolloSequenceExecutionCandidateDbRow(data as Record<string, unknown>)
  const actingUserId = input.approver_user_id?.trim() || "system"
  const actingUserEmail = input.approver_email?.trim() || "system"

  const skippedExecutionJobs = await skipApolloSequenceExecutionJobsForDraftReject(admin, {
    execution_jobs: candidate.execution_jobs,
    acting_user_id: actingUserId,
    acting_user_email: actingUserEmail,
    candidate_id: input.candidate_id,
  })

  const now = new Date().toISOString()
  const existingMetadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {}

  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "draft_rejected",
      execution_jobs: skippedExecutionJobs,
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
      metadata: mergeCandidateMetadata(existingMetadata, {
        qa_marker: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
        draft_rejected_at: now,
        draft_rejection_jobs_skipped: skippedExecutionJobs.filter(
          (job) => job.job_status === "skipped",
        ).length,
      }),
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
