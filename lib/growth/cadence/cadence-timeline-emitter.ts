import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { GrowthCadenceTask } from "@/lib/growth/cadence/cadence-types"

function taskPayload(task: Pick<GrowthCadenceTask, "id" | "channel" | "title" | "dueAt" | "status">) {
  return {
    taskId: task.id,
    channel: task.channel,
    title: task.title,
    dueAt: task.dueAt,
    status: task.status,
  }
}

export async function emitCadenceTaskCreatedTimeline(
  admin: SupabaseClient,
  input: { task: GrowthCadenceTask; enrollmentId?: string | null; stepOrder?: number | null },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.task.leadId,
    eventType: "cadence_task_created",
    title: "Cadence task created",
    summary: `${input.task.title} — owner action required.`,
    payload: {
      ...taskPayload(input.task),
      enrollmentId: input.enrollmentId ?? null,
      stepOrder: input.stepOrder ?? null,
    },
  })
}

export async function emitCadenceTaskDueTimeline(
  admin: SupabaseClient,
  input: { task: GrowthCadenceTask },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.task.leadId,
    eventType: "cadence_task_due",
    title: "Cadence task due",
    summary: `${input.task.title} is due now.`,
    payload: taskPayload(input.task),
  })
}

export async function emitCadenceTaskCompletedTimeline(
  admin: SupabaseClient,
  input: { task: GrowthCadenceTask; outcome: string },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.task.leadId,
    eventType: "cadence_task_completed",
    title: "Cadence task completed",
    summary: `${input.task.title} marked ${input.outcome.replace(/_/g, " ")}.`,
    payload: { ...taskPayload(input.task), outcome: input.outcome },
  })
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.task.leadId,
    eventType: "cadence_step_completed",
    title: "Cadence step completed",
    summary: `Sequence step completed via ${input.task.channel.replace(/_/g, " ")}.`,
    payload: { ...taskPayload(input.task), outcome: input.outcome },
  })
}

export async function emitCadenceTaskSkippedTimeline(
  admin: SupabaseClient,
  input: { task: GrowthCadenceTask; reason: string },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.task.leadId,
    eventType: "cadence_task_skipped",
    title: "Cadence task skipped",
    summary: `${input.task.title} skipped: ${input.reason}.`,
    payload: { ...taskPayload(input.task), reason: input.reason },
  })
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.task.leadId,
    eventType: "cadence_step_skipped",
    title: "Cadence step skipped",
    summary: `Sequence step skipped (${input.task.channel.replace(/_/g, " ")}).`,
    payload: { ...taskPayload(input.task), reason: input.reason },
  })
}
