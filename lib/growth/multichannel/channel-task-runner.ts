import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  evaluateChannelTaskApprovalGate,
  evaluateChannelTaskCompleteGate,
  evaluateChannelTaskSkipGate,
} from "@/lib/growth/multichannel/channel-approval-gate"
import {
  channelTasksTable,
  getSequenceChannelTask,
  insertChannelTaskEvent,
  recordChannelPlatformTimeline,
} from "@/lib/growth/multichannel/channel-events"
import { recordChannelPerformanceSnapshot } from "@/lib/growth/multichannel/channel-performance"
import type { GrowthSequenceChannelTask } from "@/lib/growth/multichannel/multichannel-types"
import { isFuturePlaceholderChannel } from "@/lib/growth/multichannel/multichannel-types"

type Row = Record<string, unknown>

export async function approveChannelTask(
  admin: SupabaseClient,
  input: { taskId: string; actorUserId: string; humanApprovalConfirmed?: boolean },
): Promise<GrowthSequenceChannelTask> {
  const task = await getSequenceChannelTask(admin, input.taskId)
  if (!task) throw new Error("task_not_found")

  const gate = evaluateChannelTaskApprovalGate({
    task,
    humanApprovalConfirmed: input.humanApprovalConfirmed,
  })
  if (!gate.allowed) throw new Error(gate.code ?? "approval_denied")

  const now = new Date().toISOString()
  const { data, error } = await channelTasksTable(admin)
    .update({
      status: "approved",
      approved_by: input.actorUserId,
      updated_at: now,
      metadata: {
        ...task.metadata,
        approval_records_intent_only: true,
        no_autonomous_external_action: true,
      },
    })
    .eq("id", input.taskId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  await insertChannelTaskEvent(admin, {
    taskId: input.taskId,
    leadId: task.leadId,
    eventType: "channel_task_approved",
    title: "Channel task approved",
    description: "Human approved task — no autonomous external action performed.",
    metadata: { approved_by: input.actorUserId, channel: task.channel },
  })
  await recordChannelPlatformTimeline(admin, {
    eventType: "channel_task_approved",
    title: task.title,
    summary: task.description,
    leadId: task.leadId,
  })

  const updated = await getSequenceChannelTask(admin, input.taskId)
  return updated ?? task
}

export async function completeChannelTask(
  admin: SupabaseClient,
  input: { taskId: string; actorUserId: string; humanApprovalConfirmed?: boolean; note?: string },
): Promise<GrowthSequenceChannelTask> {
  const task = await getSequenceChannelTask(admin, input.taskId)
  if (!task) throw new Error("task_not_found")

  const gate = evaluateChannelTaskCompleteGate({
    task,
    humanApprovalConfirmed: input.humanApprovalConfirmed,
  })
  if (!gate.allowed) throw new Error(gate.code ?? "complete_denied")

  if (isFuturePlaceholderChannel(task.channel)) {
    throw new Error("future_channel_blocked")
  }

  const now = new Date().toISOString()
  const { error } = await channelTasksTable(admin)
    .update({
      status: "completed",
      completed_by: input.actorUserId,
      resolved_at: now,
      updated_at: now,
      metadata: {
        ...task.metadata,
        completion_note: input.note ?? null,
        manually_completed: true,
      },
    })
    .eq("id", input.taskId)
  if (error) throw new Error(error.message)

  await insertChannelTaskEvent(admin, {
    taskId: input.taskId,
    leadId: task.leadId,
    eventType: "channel_task_completed",
    title: "Channel task completed",
    description: input.note ?? "Operator recorded manual completion.",
    severity: "medium",
    metadata: { completed_by: input.actorUserId, channel: task.channel },
  })
  await recordChannelPlatformTimeline(admin, {
    eventType: "channel_task_completed",
    title: task.title,
    summary: input.note ?? task.description,
    leadId: task.leadId,
  })
  await recordChannelPerformanceSnapshot(admin, {
    leadId: task.leadId,
    taskId: task.id,
    channel: task.channel,
    metadata: { completed_by: input.actorUserId },
  }).catch(() => undefined)
  await recordChannelPlatformTimeline(admin, {
    eventType: "channel_performance_recorded",
    title: "Channel performance recorded",
    summary: task.channel,
    leadId: task.leadId,
  }).catch(() => undefined)

  const updated = await getSequenceChannelTask(admin, input.taskId)
  return updated ?? task
}

export async function skipChannelTask(
  admin: SupabaseClient,
  input: { taskId: string; actorUserId: string; reason?: string },
): Promise<GrowthSequenceChannelTask> {
  const task = await getSequenceChannelTask(admin, input.taskId)
  if (!task) throw new Error("task_not_found")

  const gate = evaluateChannelTaskSkipGate({ task })
  if (!gate.allowed) throw new Error(gate.code ?? "skip_denied")

  const now = new Date().toISOString()
  const { error } = await channelTasksTable(admin)
    .update({
      status: "skipped",
      skipped_by: input.actorUserId,
      resolved_at: now,
      updated_at: now,
      metadata: {
        ...task.metadata,
        skip_reason: input.reason ?? null,
      },
    })
    .eq("id", input.taskId)
  if (error) throw new Error(error.message)

  await insertChannelTaskEvent(admin, {
    taskId: input.taskId,
    leadId: task.leadId,
    eventType: "channel_task_skipped",
    title: "Channel task skipped",
    description: input.reason ?? "Operator skipped channel task.",
    metadata: { skipped_by: input.actorUserId, channel: task.channel },
  })
  await recordChannelPlatformTimeline(admin, {
    eventType: "channel_task_skipped",
    title: task.title,
    summary: input.reason ?? "Skipped",
    leadId: task.leadId,
  })

  const updated = await getSequenceChannelTask(admin, input.taskId)
  return updated ?? task
}
