import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  attachCadenceTaskContext,
  listGrowthCadenceTasks,
  listGrowthCadenceTasksForScan,
} from "@/lib/growth/cadence/cadence-task-repository"
import {
  GROWTH_MULTI_CHANNEL_CADENCE_QA_MARKER,
  GROWTH_CADENCE_TASK_CHANNELS,
  type GrowthCadenceCommandSummary,
  type GrowthCadenceDashboard,
  type GrowthCadenceTask,
} from "@/lib/growth/cadence/cadence-types"
import { evaluateGrowthCadenceTaskNotifications } from "@/lib/growth/cadence/mutate-cadence-task"

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function endOfTodayIso(): string {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

function aggregateTasks(tasks: GrowthCadenceTask[], nowMs: number) {
  const nowIso = new Date(nowMs).toISOString()
  const todayStart = startOfTodayIso()
  const todayEnd = endOfTodayIso()
  const open = tasks.filter((t) => t.status === "open")

  const channelMix = GROWTH_CADENCE_TASK_CHANNELS.map((channel) => ({
    channel,
    count: open.filter((t) => t.channel === channel).length,
  })).filter((entry) => entry.count > 0)

  return {
    dueCount: open.filter((t) => !t.dueAt || t.dueAt >= nowIso).length,
    overdueCount: open.filter((t) => t.dueAt && t.dueAt < nowIso).length,
    completedTodayCount: tasks.filter(
      (t) =>
        t.status === "completed" &&
        t.completedAt &&
        t.completedAt >= todayStart &&
        t.completedAt <= todayEnd,
    ).length,
    skippedCount: tasks.filter((t) => t.status === "skipped").length,
    callTasksDueCount: open.filter((t) => t.channel === "manual_call" || t.channel === "voicemail").length,
    linkedinTasksDueCount: open.filter((t) => t.channel.startsWith("linkedin_")).length,
    meetingFollowupsDueCount: open.filter((t) => t.channel === "meeting_followup").length,
    channelMix,
    tasksDueTodayCount: open.filter(
      (t) => t.dueAt && t.dueAt >= todayStart && t.dueAt <= todayEnd,
    ).length,
    overdueCadenceTasksCount: open.filter((t) => t.dueAt && t.dueAt < nowIso).length,
  }
}

export async function fetchGrowthCadenceDashboard(
  admin: SupabaseClient,
  input?: { ownerUserId?: string | null },
): Promise<GrowthCadenceDashboard> {
  await evaluateGrowthCadenceTaskNotifications(admin, input)
  const tasks = await listGrowthCadenceTasksForScan(admin, input)
  const stats = aggregateTasks(tasks, Date.now())

  return {
    qaMarker: GROWTH_MULTI_CHANNEL_CADENCE_QA_MARKER,
    dueCount: stats.dueCount,
    overdueCount: stats.overdueCount,
    completedTodayCount: stats.completedTodayCount,
    skippedCount: stats.skippedCount,
    callTasksDueCount: stats.callTasksDueCount,
    linkedinTasksDueCount: stats.linkedinTasksDueCount,
    meetingFollowupsDueCount: stats.meetingFollowupsDueCount,
    channelMix: stats.channelMix,
  }
}

export async function fetchGrowthCadenceCommandSummary(
  admin: SupabaseClient,
): Promise<GrowthCadenceCommandSummary> {
  await evaluateGrowthCadenceTaskNotifications(admin)
  const tasks = await listGrowthCadenceTasksForScan(admin)
  const stats = aggregateTasks(tasks, Date.now())

  return {
    qaMarker: GROWTH_MULTI_CHANNEL_CADENCE_QA_MARKER,
    tasksDueTodayCount: stats.tasksDueTodayCount,
    overdueCadenceTasksCount: stats.overdueCadenceTasksCount,
    callTasksDueCount: stats.callTasksDueCount,
    linkedinTasksDueCount: stats.linkedinTasksDueCount,
    meetingFollowupsDueCount: stats.meetingFollowupsDueCount,
  }
}

export async function fetchGrowthCadenceTaskInbox(
  admin: SupabaseClient,
  input: Parameters<typeof listGrowthCadenceTasks>[1],
): Promise<GrowthCadenceTask[]> {
  const tasks = await listGrowthCadenceTasks(admin, input)
  return attachCadenceTaskContext(admin, tasks)
}
