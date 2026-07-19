import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"
import { canUseGrowthOutboundSoloApproval } from "@/lib/growth/runtime/outbound-solo-approval"
import { approveGrowthAiCopilotGeneration } from "@/lib/growth/run-ai-copilot-generation"
import { fetchGrowthSequenceEnrollmentStepById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import {
  recordSequenceExecutionJobAuditEvent,
  recordSequenceExecutionTimelineEvent,
} from "@/lib/growth/sequences/execution/sequence-execution-events"
import type { GrowthSequenceExecutionRunResult } from "@/lib/growth/sequences/execution/sequence-execution-types"
import {
  approveSequenceExecutionJob,
  type SequenceExecutionRunInput,
} from "@/lib/growth/sequences/execution/sequence-job-runner"
import { getSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-repository"
import { verifySupervisedJobTransportApprovalFidelity } from "@/lib/growth/sequences/execution/growth-transport-authority-job-bind-1c"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"

export type GrowthSequenceSoloApprovalResult = GrowthSequenceExecutionRunResult & {
  generationApproved?: boolean
  jobApproved?: boolean
  idempotent?: boolean
  soloApprovalUsed?: boolean
}

export async function approveSequenceExecutionJobSolo(
  admin: SupabaseClient,
  input: { jobId: string; approvedBy: string; actorEmail: string; platformAdmin?: boolean },
): Promise<GrowthSequenceSoloApprovalResult> {
  if (!canUseGrowthOutboundSoloApproval({ platformAdmin: input.platformAdmin ?? true })) {
    return {
      ok: false,
      jobId: input.jobId,
      status: "failed",
      message: "solo_approval_not_enabled",
    }
  }

  const job = await getSequenceExecutionJob(admin, input.jobId)
  if (!job) {
    return { ok: false, jobId: input.jobId, status: "failed", message: "job_not_found" }
  }

  if (job.status === "sent") {
    return {
      ok: true,
      jobId: job.id,
      status: job.status,
      message: "already_sent",
      idempotent: true,
      soloApprovalUsed: false,
    }
  }

  const jobAlreadyApproved = job.status === "approved" && Boolean(job.humanApprovedAt)
  const supervisedTransportBound = Boolean(job.outreachPackageId && job.transportSnapshot)
  let generationApproved = false
  let generationId: string | null = null

  if (supervisedTransportBound) {
    const organizationId = getGrowthEngineAiOrgId()
    if (organizationId) {
      const fidelity = await verifySupervisedJobTransportApprovalFidelity(admin, {
        jobId: job.id,
        organizationId,
      })
      if (!fidelity.ok) {
        return {
          ok: false,
          jobId: job.id,
          status: job.status,
          message: fidelity.code,
        }
      }
    }
    generationApproved = true
  } else if (job.sequenceStepId) {
    const step = await fetchGrowthSequenceEnrollmentStepById(admin, job.sequenceStepId)
    generationId = step?.generationId ?? null
  }

  if (generationId) {
    const before = await fetchGrowthAiCopilotGenerationById(admin, generationId)
    if (!before) {
      return {
        ok: false,
        jobId: job.id,
        status: job.status,
        message: "missing_generation",
      }
    }

    if (before.status === "approved") {
      generationApproved = true
    } else if (before.status === "draft") {
      const approved = await approveGrowthAiCopilotGeneration(admin, {
        generationId,
        actingUserId: input.approvedBy,
        actingUserEmail: input.actorEmail,
      })
      if (!approved || approved.status !== "approved") {
        return {
          ok: false,
          jobId: job.id,
          status: job.status,
          message: "generation_approve_failed",
        }
      }
      generationApproved = true
    } else {
      return {
        ok: false,
        jobId: job.id,
        status: job.status,
        message: "generation_not_approvable",
      }
    }
  } else {
    generationApproved = true
  }

  let jobResult: GrowthSequenceExecutionRunResult
  if (jobAlreadyApproved) {
    jobResult = {
      ok: true,
      jobId: job.id,
      status: "approved",
      message: "already_approved",
    }
  } else {
    jobResult = await approveSequenceExecutionJob(admin, {
      jobId: job.id,
      approvedBy: input.approvedBy,
      actorEmail: input.actorEmail,
      recordJobApprovedAudit: false,
      recordStepApprovedTimeline: false,
    })
    if (!jobResult.ok) return jobResult
  }

  const idempotent = jobAlreadyApproved && generationApproved

  if (!idempotent) {
    await recordSequenceExecutionJobAuditEvent(admin, {
      jobId: job.id,
      eventType: "solo_approval_used",
      title: "Solo approval: generation + job approved",
      description:
        "Unified solo approval recorded — generation and job approved for safe-execute cron.",
      metadata: {
        approved_by: input.approvedBy,
        generation_id: generationId,
        generation_approved: generationApproved,
        job_approved: true,
        idempotent: false,
        outbound_mode: "standalone",
      },
    })

    await recordSequenceExecutionTimelineEvent(admin, {
      leadId: job.leadId,
      eventType: "sequence_step_approved",
      title: "Approve & queue send",
      summary: "Solo operator approved AI draft and queued transport send for cron execution.",
      jobId: job.id,
      enrollmentId: job.sequenceEnrollmentId,
      stepId: job.sequenceStepId,
    })

    logGrowthEngine("sequence_execution_solo_approval", {
      jobId: job.id,
      generationId,
      generationApproved,
      jobApproved: true,
      idempotent: false,
      approvedBy: input.approvedBy,
    })
  } else {
    logGrowthEngine("sequence_execution_solo_approval_noop", {
      jobId: job.id,
      generationId,
      approvedBy: input.approvedBy,
    })
  }

  return {
    ...jobResult,
    generationApproved,
    jobApproved: true,
    idempotent,
    soloApprovalUsed: !idempotent,
  }
}

export type { SequenceExecutionRunInput }
