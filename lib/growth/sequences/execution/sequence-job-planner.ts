import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listDueSequenceSchedulerSteps } from "@/lib/growth/sequence-enrollment/sequence-scheduler-repository"
import { fetchGrowthOutreachQueueByEnrollmentStepId } from "@/lib/growth/outreach/outreach-queue-repository"
import type { GrowthSequenceExecutionPlanResult } from "@/lib/growth/sequences/execution/sequence-execution-types"
import {
  recordSequenceExecutionJobAuditEvent,
  recordSequenceExecutionTimelineEvent,
} from "@/lib/growth/sequences/execution/sequence-execution-events"
import {
  createSequenceExecutionJob,
  findActiveSequenceExecutionJob,
} from "@/lib/growth/sequences/execution/sequence-job-repository"

export async function planSequenceExecutionJobs(
  admin: SupabaseClient,
  input?: { limit?: number; actingUserId?: string | null },
): Promise<GrowthSequenceExecutionPlanResult> {
  const limit = input?.limit ?? 25
  const dueSteps = await listDueSequenceSchedulerSteps(admin, limit)
  const result: GrowthSequenceExecutionPlanResult = {
    scanned: dueSteps.length,
    created: 0,
    skippedExisting: 0,
    skippedNonEmail: 0,
    failed: 0,
  }

  for (const step of dueSteps) {
    if (step.channel !== "email") {
      result.skippedNonEmail += 1
      continue
    }

    try {
      const [existing, existingQueue] = await Promise.all([
        findActiveSequenceExecutionJob(admin, {
          sequenceEnrollmentId: step.enrollmentId,
          sequenceStepId: step.id,
        }),
        fetchGrowthOutreachQueueByEnrollmentStepId(admin, step.id),
      ])
      if (existing || existingQueue) {
        result.skippedExisting += 1
        continue
      }

      const scheduledFor = step.scheduledFor ?? new Date().toISOString()
      const job = await createSequenceExecutionJob(admin, {
        sequenceEnrollmentId: step.enrollmentId,
        sequenceStepId: step.id,
        leadId: step.leadId,
        scheduledFor,
        status: "pending_approval",
      })

      await recordSequenceExecutionJobAuditEvent(admin, {
        jobId: job.id,
        eventType: "job_planned",
        title: "Execution job planned",
        description: "Due sequence step queued for human approval — no send performed.",
        metadata: {
          sequence_enrollment_id: step.enrollmentId,
          sequence_step_id: step.id,
          acting_user_id: input?.actingUserId ?? null,
        },
      })

      await recordSequenceExecutionTimelineEvent(admin, {
        leadId: step.leadId,
        eventType: "sequence_step_scheduled",
        title: "Sequence step scheduled for approval",
        summary: `Step ${step.stepOrder} queued for human-approved send.`,
        jobId: job.id,
        enrollmentId: step.enrollmentId,
        stepId: step.id,
      })

      result.created += 1
    } catch {
      result.failed += 1
    }
  }

  return result
}
