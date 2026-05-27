import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertPreSendSuppressionAllowed } from "@/lib/growth/compliance/suppression-engine"
import { enforceGovernanceIfReady } from "@/lib/growth/governance/governance-enforcement"
import { advanceGrowthSequenceEnrollmentAfterStep } from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
import { skipGrowthSequenceEnrollmentStep } from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
import { executeTransportSend } from "@/lib/growth/providers/transport/transport-orchestrator"
import { assertSequenceRunApproval } from "@/lib/growth/sequences/execution/sequence-approval-gate"
import {
  recordSequenceExecutionJobAuditEvent,
  recordSequenceExecutionTimelineEvent,
} from "@/lib/growth/sequences/execution/sequence-execution-events"
import type { GrowthSequenceExecutionRunResult } from "@/lib/growth/sequences/execution/sequence-execution-types"
import {
  getSequenceExecutionJob,
  tryLockSequenceExecutionJob,
  updateSequenceExecutionJob,
} from "@/lib/growth/sequences/execution/sequence-job-repository"
import { buildSequenceExecutionSendPayload } from "@/lib/growth/sequences/execution/sequence-send-builder"

export type SequenceExecutionRunInput = {
  jobId: string
  actingUserId: string
  actingUserEmail: string
  humanApproved?: boolean
  humanApprovalConfirmed?: boolean
  approvedBy?: string | null
  lockedBy?: string
  cronMode?: boolean
}

export async function approveSequenceExecutionJob(
  admin: SupabaseClient,
  input: { jobId: string; approvedBy: string; actorEmail?: string },
): Promise<GrowthSequenceExecutionRunResult> {
  const job = await getSequenceExecutionJob(admin, input.jobId)
  if (!job) return { ok: false, jobId: input.jobId, status: "failed", message: "job_not_found" }
  if (job.status === "sent") {
    return { ok: true, jobId: job.id, status: job.status, message: "already_sent" }
  }
  if (!["draft", "pending_approval", "blocked", "failed"].includes(job.status)) {
    return { ok: false, jobId: job.id, status: job.status, message: "invalid_status_for_approval" }
  }

  await enforceGovernanceIfReady(admin, {
    action: "sequence_job_approve",
    actorUserId: input.approvedBy,
    actorEmail: input.actorEmail ?? input.approvedBy,
    sourceRoute: "sequence_execution.approve",
    entityType: "sequence_execution_job",
    entityId: job.id,
    approvalReason: "Human approved sequence execution job.",
    humanApprovalConfirmed: true,
  })

  const now = new Date().toISOString()
  const updated = await updateSequenceExecutionJob(admin, job.id, {
    status: "approved",
    humanApprovedAt: now,
    humanApprovedBy: input.approvedBy,
    lastError: null,
  })

  await recordSequenceExecutionJobAuditEvent(admin, {
    jobId: job.id,
    eventType: "job_approved",
    title: "Execution job approved",
    description: "Human approval recorded — send still requires explicit run.",
    metadata: { approved_by: input.approvedBy },
  })

  await recordSequenceExecutionTimelineEvent(admin, {
    leadId: job.leadId,
    eventType: "sequence_step_approved",
    title: "Sequence step approved",
    summary: "Human approved sequence step for send.",
    jobId: job.id,
    enrollmentId: job.sequenceEnrollmentId,
    stepId: job.sequenceStepId,
  })

  return { ok: true, jobId: updated.id, status: updated.status }
}

export async function skipSequenceExecutionJob(
  admin: SupabaseClient,
  input: { jobId: string; actingUserId: string; actingUserEmail: string; reason?: string },
): Promise<GrowthSequenceExecutionRunResult> {
  const job = await getSequenceExecutionJob(admin, input.jobId)
  if (!job) return { ok: false, jobId: input.jobId, status: "failed", message: "job_not_found" }
  if (job.status === "sent") {
    return { ok: false, jobId: job.id, status: job.status, message: "already_sent" }
  }

  const updated = await updateSequenceExecutionJob(admin, job.id, {
    status: "skipped",
    lockedAt: null,
    lockedBy: null,
    lastError: input.reason?.slice(0, 500) ?? null,
  })

  if (job.sequenceStepId) {
    await skipGrowthSequenceEnrollmentStep(admin, {
      stepId: job.sequenceStepId,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
    })
  }

  await recordSequenceExecutionJobAuditEvent(admin, {
    jobId: job.id,
    eventType: "job_skipped",
    title: "Execution job skipped",
    description: input.reason ?? "Skipped by operator.",
  })

  await recordSequenceExecutionTimelineEvent(admin, {
    leadId: job.leadId,
    eventType: "sequence_step_skipped",
    title: "Sequence step skipped",
    summary: input.reason ?? "Step skipped during safe execution.",
    jobId: job.id,
    enrollmentId: job.sequenceEnrollmentId,
    stepId: job.sequenceStepId,
  })

  return { ok: true, jobId: updated.id, status: updated.status }
}

export async function runSequenceExecutionJob(
  admin: SupabaseClient,
  input: SequenceExecutionRunInput,
): Promise<GrowthSequenceExecutionRunResult> {
  const job = await getSequenceExecutionJob(admin, input.jobId)
  if (!job) return { ok: false, jobId: input.jobId, status: "failed", message: "job_not_found" }

  if (job.status === "sent" && job.deliveryAttemptId) {
    return {
      ok: true,
      jobId: job.id,
      status: job.status,
      deliveryAttemptId: job.deliveryAttemptId,
      message: "already_sent",
    }
  }

  if (job.status !== "approved") {
    return {
      ok: false,
      jobId: job.id,
      status: job.status,
      message: "job_not_approved",
      blocked: true,
    }
  }

  try {
    assertSequenceRunApproval({
      job,
      humanApproved: input.humanApproved,
      humanApprovalConfirmed: input.humanApprovalConfirmed,
      approvedBy: input.approvedBy ?? input.actingUserId,
    })
  } catch (e) {
    const code = e instanceof Error ? e.message : "human_approval_required"
    await updateSequenceExecutionJob(admin, job.id, {
      status: "blocked",
      lastError: code,
      lockedAt: null,
      lockedBy: null,
    })
    await recordSequenceExecutionTimelineEvent(admin, {
      leadId: job.leadId,
      eventType: "sequence_step_blocked",
      title: "Sequence step blocked",
      summary: "Send blocked — human approval required.",
      jobId: job.id,
      enrollmentId: job.sequenceEnrollmentId,
      stepId: job.sequenceStepId,
    })
    return { ok: false, jobId: job.id, status: "blocked", message: code, blocked: true }
  }

  const locked = await tryLockSequenceExecutionJob(admin, job.id, input.lockedBy ?? input.actingUserId)
  if (!locked) {
    return { ok: false, jobId: job.id, status: job.status, message: "job_locked" }
  }

  if (!locked.sequenceStepId) {
    await finalizeBlockedJob(admin, locked, "missing_step")
    return { ok: false, jobId: locked.id, status: "blocked", message: "missing_step", blocked: true }
  }

  const payload = await buildSequenceExecutionSendPayload(admin, {
    sequenceStepId: locked.sequenceStepId,
    leadId: locked.leadId,
    sequenceEnrollmentId: locked.sequenceEnrollmentId,
    senderPoolId: locked.senderPoolId,
    allowAutoRotation: locked.allowAutoRotation,
    manualSenderAccountId: locked.manualSenderAccountId,
    sequenceExecutionJobId: locked.id,
  })

  if ("error" in payload) {
    await finalizeBlockedJob(admin, locked, payload.error)
    return { ok: false, jobId: locked.id, status: "blocked", message: payload.error, blocked: true }
  }

  try {
    await enforceGovernanceIfReady(admin, {
      action: "sequence_job_run",
      actorUserId: input.actingUserId,
      actorEmail: input.actingUserEmail,
      sourceRoute: "sequence_execution.run",
      entityType: "sequence_execution_job",
      entityId: locked.id,
      recipientEmail: payload.to,
      humanApprovalConfirmed: input.humanApprovalConfirmed ?? true,
      approvalReason: "Human confirmed sequence execution run.",
    })
  } catch (e) {
    const code = e instanceof Error ? e.message : "governance_policy_blocked"
    await finalizeBlockedJob(admin, locked, code)
    return { ok: false, jobId: locked.id, status: "blocked", message: code, blocked: true }
  }

  const suppression = await assertPreSendSuppressionAllowed(admin, {
    email: payload.to,
    leadId: locked.leadId,
    senderAccountId: payload.senderAccountId,
  })
  if (!suppression.allowed) {
    await finalizeBlockedJob(admin, locked, suppression.reason ?? "suppression_blocked")
    return {
      ok: false,
      jobId: locked.id,
      status: "blocked",
      message: suppression.reason ?? "suppression_blocked",
      blocked: true,
    }
  }

  const transport = await executeTransportSend(admin, {
    sender_account_id: payload.senderAccountId,
    sender_pool_id: payload.senderPoolId ?? locked.senderPoolId,
    allow_auto_rotation: payload.allowAutoRotation ?? locked.allowAutoRotation,
    manual_sender_account_id: payload.manualSenderAccountId ?? locked.manualSenderAccountId,
    sequence_execution_job_id: locked.id,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    lead_id: locked.leadId,
    sequence_enrollment_id: locked.sequenceEnrollmentId,
    human_approved: true,
    human_approval_confirmed: true,
    actorUserId: input.actingUserId,
    actorEmail: input.actingUserEmail,
    metadata: {
      ...(payload.experimentId && payload.experimentVariantId
        ? {
            experiment_id: payload.experimentId,
            experiment_variant_id: payload.experimentVariantId,
            experiment_variant_label: payload.experimentVariantLabel ?? null,
          }
        : {}),
      ...(payload.contentTemplateVersionId
        ? {
            content_template_version_id: payload.contentTemplateVersionId,
            content_template_id: payload.contentTemplateId ?? null,
          }
        : {}),
      ...(payload.personalizationGenerationId
        ? { personalization_generation_id: payload.personalizationGenerationId }
        : {}),
      governance_audit_recorded: true,
    },
  })

  if (!transport.ok || !transport.attempt) {
    const nextStatus = transport.requires_human_review ? "blocked" : "failed"
    const updated = await updateSequenceExecutionJob(admin, locked.id, {
      status: nextStatus,
      lastError: transport.error ?? "transport_failed",
      deliveryAttemptId: transport.attempt?.id ?? null,
      senderAccountId: payload.senderAccountId,
      providerId: transport.attempt?.provider_id ?? null,
      lockedAt: null,
      lockedBy: null,
      attemptCount: locked.attemptCount + 1,
    })

    await recordSequenceExecutionJobAuditEvent(admin, {
      jobId: locked.id,
      eventType: nextStatus === "blocked" ? "job_blocked" : "job_failed",
      title: nextStatus === "blocked" ? "Execution blocked" : "Execution failed",
      description: transport.error ?? "Transport send failed.",
      severity: nextStatus === "blocked" ? "high" : "medium",
      metadata: { delivery_attempt_id: transport.attempt?.id ?? null },
    })

    await recordSequenceExecutionTimelineEvent(admin, {
      leadId: locked.leadId,
      eventType: nextStatus === "blocked" ? "sequence_step_blocked" : "sequence_step_failed",
      title: nextStatus === "blocked" ? "Sequence step blocked" : "Sequence step failed",
      summary: transport.error ?? "Send could not complete.",
      jobId: locked.id,
      enrollmentId: locked.sequenceEnrollmentId,
      stepId: locked.sequenceStepId,
      deliveryAttemptId: transport.attempt?.id ?? null,
    })

    return {
      ok: false,
      jobId: updated.id,
      status: updated.status,
      deliveryAttemptId: transport.attempt?.id ?? null,
      message: transport.error,
      blocked: nextStatus === "blocked",
    }
  }

  const updated = await updateSequenceExecutionJob(admin, locked.id, {
    status: "sent",
    deliveryAttemptId: transport.attempt.id,
    senderAccountId: payload.senderAccountId,
    providerId: transport.attempt.provider_id,
    lastError: null,
    lockedAt: null,
    lockedBy: null,
    attemptCount: locked.attemptCount + 1,
  })

  await recordSequenceExecutionJobAuditEvent(admin, {
    jobId: locked.id,
    eventType: "job_sent",
    title: "Execution job sent",
    description: "Transport accepted delivery attempt.",
    metadata: {
      delivery_attempt_id: transport.attempt.id,
      provider_message_id: transport.provider_message_id ?? null,
      cron_mode: input.cronMode ?? false,
      experiment_id: payload.experimentId ?? null,
      experiment_variant_id: payload.experimentVariantId ?? null,
      experiment_variant_label: payload.experimentVariantLabel ?? null,
    },
  })

  if (payload.experimentId && payload.experimentVariantId) {
    const { incrementExperimentMetric, linkExperimentAssignmentDeliveryAttempt } = await import(
      "@/lib/growth/experiments/experiment-metrics"
    )
    await incrementExperimentMetric(admin, {
      experimentId: payload.experimentId,
      variantId: payload.experimentVariantId,
      metric: "sent",
    })
    await linkExperimentAssignmentDeliveryAttempt(admin, {
      experimentId: payload.experimentId,
      leadId: locked.leadId,
      deliveryAttemptId: transport.attempt.id,
    })
  }

  const { recordPerformanceSnapshotAfterSend } = await import(
    "@/lib/growth/revenue-intelligence/performance-snapshots"
  )
  await recordPerformanceSnapshotAfterSend(admin, {
    leadId: locked.leadId,
    sequenceEnrollmentId: locked.sequenceEnrollmentId,
    senderAccountId: payload.senderAccountId,
    providerId: transport.attempt.provider_id,
    deliveryAttemptId: transport.attempt.id,
    experimentId: payload.experimentId ?? null,
    variantId: payload.experimentVariantId ?? null,
  }).catch(() => undefined)

  await recordSequenceExecutionTimelineEvent(admin, {
    leadId: locked.leadId,
    eventType: "sequence_step_sent",
    title: "Sequence step sent",
    summary: "Approved sequence step delivered via provider transport.",
    jobId: locked.id,
    enrollmentId: locked.sequenceEnrollmentId,
    stepId: locked.sequenceStepId,
    deliveryAttemptId: transport.attempt.id,
  })

  await advanceGrowthSequenceEnrollmentAfterStep(admin, {
    enrollmentStepId: locked.sequenceStepId,
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
  })

  return {
    ok: true,
    jobId: updated.id,
    status: updated.status,
    deliveryAttemptId: transport.attempt.id,
  }
}

export async function runApprovedDueSequenceExecutionJobs(
  admin: SupabaseClient,
  input: { actingUserId: string; actingUserEmail: string; limit?: number },
): Promise<{ scanned: number; sent: number; blocked: number; failed: number; skippedLocked: number }> {
  const { listApprovedDueSequenceExecutionJobs } = await import(
    "@/lib/growth/sequences/execution/sequence-job-repository"
  )
  const jobs = await listApprovedDueSequenceExecutionJobs(admin, input.limit ?? 25)
  const summary = { scanned: jobs.length, sent: 0, blocked: 0, failed: 0, skippedLocked: 0 }

  for (const job of jobs) {
    const result = await runSequenceExecutionJob(admin, {
      jobId: job.id,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
      humanApproved: true,
      humanApprovalConfirmed: true,
      approvedBy: job.humanApprovedBy,
      lockedBy: "cron:growth-sequence-safe-execute",
      cronMode: true,
    })

    if (result.message === "job_locked") {
      summary.skippedLocked += 1
      continue
    }
    if (result.ok && result.status === "sent") summary.sent += 1
    else if (result.blocked) summary.blocked += 1
    else summary.failed += 1
  }

  return summary
}

async function finalizeBlockedJob(
  admin: SupabaseClient,
  job: { id: string; leadId: string; sequenceEnrollmentId: string; sequenceStepId: string | null; attemptCount: number },
  reason: string,
): Promise<void> {
  await updateSequenceExecutionJob(admin, job.id, {
    status: "blocked",
    lastError: reason,
    lockedAt: null,
    lockedBy: null,
    attemptCount: job.attemptCount + 1,
  })

  await recordSequenceExecutionJobAuditEvent(admin, {
    jobId: job.id,
    eventType: "job_blocked",
    title: "Execution blocked",
    description: reason,
    severity: "high",
  })

  await recordSequenceExecutionTimelineEvent(admin, {
    leadId: job.leadId,
    eventType: "sequence_step_blocked",
    title: "Sequence step blocked",
    summary: reason,
    jobId: job.id,
    enrollmentId: job.sequenceEnrollmentId,
    stepId: job.sequenceStepId,
  })
}
