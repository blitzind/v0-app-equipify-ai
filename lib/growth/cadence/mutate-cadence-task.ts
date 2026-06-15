import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  emitCadenceTaskCompletedNotification,
  emitCadenceTaskOverdueNotification,
  emitCadenceTaskSkippedNotification,
  emitCadenceTaskDueNotification,
} from "@/lib/growth/cadence/cadence-notifications"
import {
  emitCadenceTaskCompletedTimeline,
  emitCadenceTaskSkippedTimeline,
} from "@/lib/growth/cadence/cadence-timeline-emitter"
import { recordSequenceEnrollmentChannelEvent } from "@/lib/growth/sequence-orchestration/sequence-multi-channel-state-repository"
import {
  fetchGrowthCadenceTaskById,
  listGrowthCadenceTasksForScan,
  updateGrowthCadenceTaskRow,
} from "@/lib/growth/cadence/cadence-task-repository"
import type { GrowthCadenceTask, GrowthCadenceTaskOutcome } from "@/lib/growth/cadence/cadence-types"
import { advanceGrowthSequenceEnrollmentAfterStep } from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
import { dispatchSequenceEventWakeSafely } from "@/lib/growth/sequences/conditions/sequence-event-wake-engine"
import { fetchGrowthSequenceEnrollmentStepById, updateGrowthSequenceEnrollmentStep } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { recomputeGrowthLeadNextBestAction } from "@/lib/growth/recompute-lead-next-best-action"

export async function completeGrowthCadenceTask(
  admin: SupabaseClient,
  input: {
    taskId: string
    outcome: GrowthCadenceTaskOutcome
    actingUserId: string
    actingUserEmail: string
  },
): Promise<GrowthCadenceTask> {
  const existing = await fetchGrowthCadenceTaskById(admin, input.taskId)
  if (!existing) throw new Error("not_found")
  if (existing.status !== "open") throw new Error("invalid_status")

  const lead = await fetchGrowthLeadById(admin, existing.leadId)
  if (!lead) throw new Error("lead_not_found")

  const now = new Date().toISOString()
  const task = await updateGrowthCadenceTaskRow(admin, input.taskId, {
    status: "completed",
    outcome: input.outcome,
    completed_at: now,
    completed_by: input.actingUserId,
  })

  if (existing.sequenceEnrollmentStepId) {
    await updateGrowthSequenceEnrollmentStep(admin, existing.sequenceEnrollmentStepId, {
      stepOutcome: input.outcome,
    })
    await advanceGrowthSequenceEnrollmentAfterStep(admin, {
      enrollmentStepId: existing.sequenceEnrollmentStepId,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
    })
  }

  await emitCadenceTaskCompletedTimeline(admin, { task, outcome: input.outcome })
  await emitCadenceTaskCompletedNotification(admin, {
    task,
    companyName: lead.companyName,
    outcome: input.outcome,
  })

  if (existing.sequenceEnrollmentStepId && (existing.channel === "manual_call" || existing.channel === "voicemail")) {
    const enrollmentStep = await fetchGrowthSequenceEnrollmentStepById(admin, existing.sequenceEnrollmentStepId)
    if (enrollmentStep) {
      await recordSequenceEnrollmentChannelEvent(admin, {
        enrollmentId: enrollmentStep.enrollmentId,
        enrollmentStepId: existing.sequenceEnrollmentStepId,
        leadId: existing.leadId,
        channel: existing.channel,
        eventKind: "call_completed",
        title: "Call Completed",
        summary: `Outcome: ${input.outcome}`,
        metadata: {
          cadence_task_id: task.id,
          outcome: input.outcome,
          sequence_enrollment_id: enrollmentStep.enrollmentId,
          sequence_enrollment_step_id: existing.sequenceEnrollmentStepId,
          sequence_execution_job_id: existing.sequenceExecutionJobId ?? task.sequenceExecutionJobId ?? null,
        },
      }).catch(() => undefined)
      dispatchSequenceEventWakeSafely(admin, {
        leadId: existing.leadId,
        sequenceEnrollmentId: enrollmentStep.enrollmentId,
        sequenceEnrollmentStepId: existing.sequenceEnrollmentStepId,
        source: "cadence",
        event: "call_task.completed",
        evidenceRef: task.id,
        occurredAt: now,
      })
    }
  }

  if (existing.channel === "manual_call" || existing.channel === "voicemail") {
    await recomputeGrowthLeadNextBestAction(admin, existing.leadId)
  }

  return task
}

export async function skipGrowthCadenceTask(
  admin: SupabaseClient,
  input: {
    taskId: string
    reason: string
    actingUserId: string
    actingUserEmail: string
  },
): Promise<GrowthCadenceTask> {
  const existing = await fetchGrowthCadenceTaskById(admin, input.taskId)
  if (!existing) throw new Error("not_found")
  if (existing.status !== "open") throw new Error("invalid_status")

  const lead = await fetchGrowthLeadById(admin, existing.leadId)
  if (!lead) throw new Error("lead_not_found")

  const now = new Date().toISOString()
  const task = await updateGrowthCadenceTaskRow(admin, input.taskId, {
    status: "skipped",
    outcome: "skipped",
    skipped_reason: input.reason.trim(),
    completed_at: now,
    completed_by: input.actingUserId,
  })

  if (existing.sequenceEnrollmentStepId) {
    await updateGrowthSequenceEnrollmentStep(admin, existing.sequenceEnrollmentStepId, {
      status: "skipped",
      skipReason: input.reason.trim(),
      completedAt: now,
    })
    await advanceGrowthSequenceEnrollmentAfterStep(admin, {
      enrollmentStepId: existing.sequenceEnrollmentStepId,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
    })
  }

  await emitCadenceTaskSkippedTimeline(admin, { task, reason: input.reason.trim() })
  await emitCadenceTaskSkippedNotification(admin, {
    task,
    companyName: lead.companyName,
    reason: input.reason.trim(),
  })

  return task
}

export async function evaluateGrowthCadenceTaskNotifications(
  admin: SupabaseClient,
  input?: { ownerUserId?: string | null },
): Promise<void> {
  const now = Date.now()
  const tasks = await listGrowthCadenceTasksForScan(admin, input)

  for (const task of tasks) {
    if (task.status !== "open" || !task.dueAt) continue
    const lead = await fetchGrowthLeadById(admin, task.leadId)
    const companyName = lead?.companyName ?? "Lead"
    const dueMs = Date.parse(task.dueAt)

    if (dueMs <= now && dueMs > now - 15 * 60 * 1000) {
      await emitCadenceTaskDueNotification(admin, { task, companyName })
    } else if (dueMs < now - 60 * 60 * 1000) {
      await emitCadenceTaskOverdueNotification(admin, { task, companyName })
    }
  }
}
