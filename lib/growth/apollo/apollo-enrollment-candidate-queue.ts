/** Apollo Enrollment Automation — server-only queue + actions. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeGrowthActorUserIdForDb } from "@/lib/growth/actor-user-id"
import {
  buildApolloEnrollmentCandidateQueueSnapshot,
  evaluateApolloEnrollmentApprovalGate,
  mapApolloEnrollmentCandidateDbRow,
} from "@/lib/growth/apollo/apollo-enrollment-automation-evidence"
import {
  APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER,
  type ApolloEnrollmentAutomationActionResult,
  type ApolloEnrollmentCandidateQueueSnapshot,
  type ApolloEnrollmentCandidateStatus,
} from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import { handoffEnrollmentApprovedToAccountPlaybook } from "@/lib/growth/apollo/apollo-account-playbooks-bridge"
import { loadApolloQueueRows, paginateMappedApolloQueueRows } from "@/lib/growth/apollo/apollo-queue-loader"
import type { ApolloQueuePaginationInput } from "@/lib/growth/apollo/apollo-queue-pagination"

export {
  APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER,
  type ApolloEnrollmentCandidateQueueSnapshot,
  type ApolloEnrollmentAutomationActionResult,
} from "@/lib/growth/apollo/apollo-enrollment-automation-types"

const CANDIDATES_TABLE = "apollo_enrollment_candidates"

function emptyActionResult(
  action: ApolloEnrollmentAutomationActionResult["action"],
  error: string,
): ApolloEnrollmentAutomationActionResult {
  return {
    ok: false,
    action,
    candidate_id: null,
    candidate_ids: [],
    status: null,
    error,
    auto_enrollment: false,
    outreach_sent: false,
    enrolled_count: 0,
    outreach_count: 0,
  }
}

export async function loadApolloEnrollmentCandidateQueue(
  admin: SupabaseClient,
  input?: {
    company_candidate_id?: string | null
    status?: ApolloEnrollmentCandidateStatus | "all"
    limit?: number
    pagination?: ApolloQueuePaginationInput
  },
): Promise<ApolloEnrollmentCandidateQueueSnapshot> {
  const rows = await loadApolloQueueRows(admin, {
    table: CANDIDATES_TABLE,
    company_candidate_id: input?.company_candidate_id ?? null,
    status: input?.status ?? "all",
    scanLimit: input?.limit ?? undefined,
  })

  const mapped = rows.map(mapApolloEnrollmentCandidateDbRow)
  const paged = paginateMappedApolloQueueRows(mapped, input?.pagination)
  return buildApolloEnrollmentCandidateQueueSnapshot({
    items: paged.items,
    pagination: paged.pagination,
  })
}

export async function approveApolloEnrollmentCandidate(
  admin: SupabaseClient,
  input: {
    candidate_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<ApolloEnrollmentAutomationActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(CANDIDATES_TABLE)
    .select("*")
    .eq("id", input.candidate_id)
    .maybeSingle()

  if (error) return emptyActionResult("approve_enrollment", error.message)
  if (!data) return emptyActionResult("approve_enrollment", "candidate_not_found")

  const candidate = mapApolloEnrollmentCandidateDbRow(data as Record<string, unknown>)
  const gate = evaluateApolloEnrollmentApprovalGate({ candidate })
  if (!gate.allowed) {
    return emptyActionResult("approve_enrollment", gate.code ?? "approval_blocked")
  }

  const now = new Date().toISOString()
  const approverUserId = normalizeGrowthActorUserIdForDb(input.approver_user_id)
  const { error: updateError } = await admin
    .schema("growth")
    .from(CANDIDATES_TABLE)
    .update({
      status: "enrollment_approved",
      enrollment_approved_at: now,
      enrollment_approved_by: approverUserId,
      enrollment_approved_email: input.approver_email ?? null,
      auto_enrollment_attempted: false,
      outreach_sent: false,
      updated_at: now,
      metadata: {
        qa_marker: APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER,
        enrollment_approval_note: input.note?.trim() || null,
      },
    })
    .eq("id", input.candidate_id)

  if (updateError) {
    return emptyActionResult("approve_enrollment", updateError.message)
  }

  await handoffEnrollmentApprovedToAccountPlaybook(admin, {
    enrollment_candidate_id: candidate.candidate_id,
    company_candidate_id: candidate.company_candidate_id,
    canonical_company_id: null,
    company_contact_id: candidate.company_contact_id,
    contact_candidate_id: candidate.contact_candidate_id,
    growth_lead_id: candidate.growth_lead_id,
    company_name: candidate.company_name,
    full_name: candidate.full_name,
    title: candidate.title,
    email: candidate.email,
    phone: candidate.phone,
    qualification_score: candidate.qualification_score,
    fit_score: candidate.fit_score,
    research_score: candidate.research_score,
    operator_intelligence: candidate.operator_intelligence as unknown as Record<string, unknown>,
    source_attribution: candidate.source_attribution as unknown as Record<string, unknown>,
    acquisition_evidence: candidate.acquisition_evidence,
  })

  return {
    ok: true,
    action: "approve_enrollment",
    candidate_id: input.candidate_id,
    candidate_ids: [input.candidate_id],
    status: "enrollment_approved",
    auto_enrollment: false,
    outreach_sent: false,
    enrolled_count: 0,
    outreach_count: 0,
  }
}

export async function rejectApolloEnrollmentCandidate(
  admin: SupabaseClient,
  input: {
    candidate_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<ApolloEnrollmentAutomationActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(CANDIDATES_TABLE)
    .select("*")
    .eq("id", input.candidate_id)
    .maybeSingle()

  if (error) return emptyActionResult("reject_enrollment", error.message)
  if (!data) return emptyActionResult("reject_enrollment", "candidate_not_found")

  const candidate = mapApolloEnrollmentCandidateDbRow(data as Record<string, unknown>)
  if (candidate.status !== "pending_enrollment_approval") {
    return emptyActionResult("reject_enrollment", "invalid_candidate_status")
  }

  const now = new Date().toISOString()
  const approverUserId = normalizeGrowthActorUserIdForDb(input.approver_user_id)
  const { error: updateError } = await admin
    .schema("growth")
    .from(CANDIDATES_TABLE)
    .update({
      status: "enrollment_rejected",
      enrollment_approved_by: approverUserId,
      enrollment_approved_email: input.approver_email ?? null,
      enrollment_rejection_note: input.note?.trim() || null,
      auto_enrollment_attempted: false,
      outreach_sent: false,
      updated_at: now,
      metadata: { qa_marker: APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER },
    })
    .eq("id", input.candidate_id)

  if (updateError) {
    return emptyActionResult("reject_enrollment", updateError.message)
  }

  return {
    ok: true,
    action: "reject_enrollment",
    candidate_id: input.candidate_id,
    candidate_ids: [input.candidate_id],
    status: "enrollment_rejected",
    auto_enrollment: false,
    outreach_sent: false,
    enrolled_count: 0,
    outreach_count: 0,
  }
}

export async function requestApolloEnrollmentResearchRerun(
  admin: SupabaseClient,
  input: {
    candidate_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<ApolloEnrollmentAutomationActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(CANDIDATES_TABLE)
    .select("id, status")
    .eq("id", input.candidate_id)
    .maybeSingle()

  if (error) return emptyActionResult("rerun_research", error.message)
  if (!data) return emptyActionResult("rerun_research", "candidate_not_found")

  const status = typeof data.status === "string" ? data.status : ""
  if (status !== "pending_enrollment_approval" && status !== "enrollment_rejected") {
    return emptyActionResult("rerun_research", "invalid_candidate_status")
  }

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .schema("growth")
    .from(CANDIDATES_TABLE)
    .update({
      status: "research_rerun_requested",
      auto_enrollment_attempted: false,
      outreach_sent: false,
      updated_at: now,
      metadata: {
        qa_marker: APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER,
        research_rerun_note: input.note?.trim() || null,
        research_rerun_requested_by: input.approver_email ?? null,
        research_rerun_requested_at: now,
      },
    })
    .eq("id", input.candidate_id)

  if (updateError) {
    return emptyActionResult("rerun_research", updateError.message)
  }

  return {
    ok: true,
    action: "rerun_research",
    candidate_id: input.candidate_id,
    candidate_ids: [input.candidate_id],
    status: "research_rerun_requested",
    auto_enrollment: false,
    outreach_sent: false,
    enrolled_count: 0,
    outreach_count: 0,
  }
}
