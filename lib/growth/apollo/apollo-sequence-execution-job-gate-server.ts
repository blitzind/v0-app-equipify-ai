/** Apollo sequence execution job gate — server-only DB lookups and job cleanup. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { updateSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-repository"
import { recordSequenceExecutionJobAuditEvent } from "@/lib/growth/sequences/execution/sequence-execution-events"
import type { ApolloSequenceExecutionCandidateStatus } from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import type { ApolloSequenceExecutionJobLink } from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import {
  APOLLO_DRAFT_REJECTED_JOB_SKIP_REASON,
  evaluateApolloSequenceExecutionJobApprovalGate,
} from "@/lib/growth/apollo/apollo-sequence-execution-job-gate"

const CANDIDATES_TABLE = "apollo_sequence_execution_candidates"

export async function resolveApolloSequenceExecutionCandidateStatusForEnrollment(
  admin: SupabaseClient,
  sequenceEnrollmentId: string,
): Promise<{
  candidate_id: string
  status: ApolloSequenceExecutionCandidateStatus
} | null> {
  const enrollmentId = sequenceEnrollmentId.trim()
  if (!enrollmentId) return null

  const { data, error } = await admin
    .schema("growth")
    .from(CANDIDATES_TABLE)
    .select("id, status")
    .eq("sequence_enrollment_id", enrollmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  const candidateId = typeof data.id === "string" ? data.id : null
  const status = typeof data.status === "string" ? data.status : null
  if (!candidateId || !status) return null

  return {
    candidate_id: candidateId,
    status: status as ApolloSequenceExecutionCandidateStatus,
  }
}

export async function evaluateApolloSequenceExecutionJobApprovalGateForJob(
  admin: SupabaseClient,
  input: { sequenceEnrollmentId: string },
) {
  const candidate = await resolveApolloSequenceExecutionCandidateStatusForEnrollment(
    admin,
    input.sequenceEnrollmentId,
  )
  return evaluateApolloSequenceExecutionJobApprovalGate({
    apollo_candidate_status: candidate?.status ?? null,
  })
}

export async function skipApolloSequenceExecutionJobsForDraftReject(
  admin: SupabaseClient,
  input: {
    execution_jobs: ApolloSequenceExecutionJobLink[]
    acting_user_id: string
    acting_user_email: string
    candidate_id: string
  },
): Promise<ApolloSequenceExecutionJobLink[]> {
  const updatedLinks: ApolloSequenceExecutionJobLink[] = []

  for (const link of input.execution_jobs) {
    const jobId = link.execution_job_id?.trim()
    if (!jobId) {
      updatedLinks.push(link)
      continue
    }

    if (!["pending_approval", "draft"].includes(link.job_status)) {
      updatedLinks.push(link)
      continue
    }

    await updateSequenceExecutionJob(admin, jobId, {
      status: "skipped",
      lockedAt: null,
      lockedBy: null,
      lastError: APOLLO_DRAFT_REJECTED_JOB_SKIP_REASON,
    })

    await recordSequenceExecutionJobAuditEvent(admin, {
      jobId,
      eventType: "job_skipped",
      title: "Execution job skipped — draft rejected",
      description:
        "Associated Apollo sequence draft was rejected; job skipped to prevent orphan pending approval.",
      metadata: {
        skip_reason: APOLLO_DRAFT_REJECTED_JOB_SKIP_REASON,
        apollo_sequence_execution_candidate_id: input.candidate_id,
        skipped_by: input.acting_user_id,
        skipped_by_email: input.acting_user_email,
      },
    })

    updatedLinks.push({
      ...link,
      job_status: "skipped",
    })
  }

  return updatedLinks
}

export async function restoreApolloSequenceExecutionJobsAfterDraftRegenerate(
  admin: SupabaseClient,
  input: {
    execution_jobs: ApolloSequenceExecutionJobLink[]
    candidate_id: string
    acting_user_id: string
    acting_user_email: string
  },
): Promise<ApolloSequenceExecutionJobLink[]> {
  const updatedLinks: ApolloSequenceExecutionJobLink[] = []

  for (const link of input.execution_jobs) {
    const jobId = link.execution_job_id?.trim()
    if (!jobId) {
      updatedLinks.push(link)
      continue
    }

    if (link.job_status !== "skipped") {
      updatedLinks.push(link)
      continue
    }

    const { data: jobRow } = await admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("status, last_error")
      .eq("id", jobId)
      .maybeSingle()

    const lastError = typeof jobRow?.last_error === "string" ? jobRow.last_error : null
    if (jobRow?.status !== "skipped" || lastError !== APOLLO_DRAFT_REJECTED_JOB_SKIP_REASON) {
      updatedLinks.push(link)
      continue
    }

    await updateSequenceExecutionJob(admin, jobId, {
      status: "pending_approval",
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    })

    await recordSequenceExecutionJobAuditEvent(admin, {
      jobId,
      eventType: "sequence_execution_job_restored",
      title: "Execution job restored — draft regenerated",
      description: "Draft regenerated after rejection; job returned to pending approval.",
      metadata: {
        apollo_sequence_execution_candidate_id: input.candidate_id,
        restored_by: input.acting_user_id,
        restored_by_email: input.acting_user_email,
      },
    })

    updatedLinks.push({
      ...link,
      job_status: "pending_approval",
    })
  }

  return updatedLinks
}
