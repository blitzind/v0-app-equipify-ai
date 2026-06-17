import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { emitGrowthNotification } from "@/lib/growth/notifications/emit-growth-notification"
import type { GrowthCadenceTask, GrowthCadenceTaskChannel } from "@/lib/growth/cadence/cadence-types"
import { cadenceLeadDrawerHref } from "@/lib/growth/cadence/cadence-channel-engine"
import { growthCallNotificationActionHref } from "@/lib/growth/navigation/growth-call-notification-links"

function cadenceTaskHref(task: Pick<GrowthCadenceTask, "leadId" | "channel">): string {
  if (task.channel === "manual_call") {
    return growthCallNotificationActionHref({ notificationType: "manual_call_due", leadId: task.leadId })
  }
  if (task.channel === "voicemail") {
    return growthCallNotificationActionHref({
      notificationType: "voicemail",
      leadId: task.leadId,
      channel: "voicemail",
    })
  }
  if (task.channel === "meeting_followup") {
    return cadenceLeadDrawerHref(task.leadId, "meetings")
  }
  return cadenceLeadDrawerHref(task.leadId, "sequence")
}

function channelNotificationType(channel: GrowthCadenceTaskChannel): "manual_call_due" | "linkedin_task_due" | "meeting_followup_due" | "cadence_task_due" {
  if (channel === "manual_call" || channel === "voicemail") return "manual_call_due"
  if (channel.startsWith("linkedin_")) return "linkedin_task_due"
  if (channel === "meeting_followup") return "meeting_followup_due"
  return "cadence_task_due"
}

export async function emitCadenceTaskDueNotification(
  admin: SupabaseClient,
  input: { task: GrowthCadenceTask; companyName: string },
): Promise<void> {
  const notificationType = channelNotificationType(input.task.channel)
  await emitGrowthNotification(admin, {
    ownerUserId: input.task.ownerUserId,
    leadId: input.task.leadId,
    notificationType,
    title: "Cadence task due",
    body: `${input.companyName}: ${input.task.title}`,
    sourceSystem: "scheduler",
    sourceId: input.task.id,
    actionUrl: cadenceTaskHref(input.task),
    metadata: { companyName: input.companyName, channel: input.task.channel },
  })
}

export async function emitCadenceTaskOverdueNotification(
  admin: SupabaseClient,
  input: { task: GrowthCadenceTask; companyName: string },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.task.ownerUserId,
    leadId: input.task.leadId,
    notificationType: "cadence_task_overdue",
    title: "Cadence task overdue",
    body: `${input.companyName}: ${input.task.title} is overdue.`,
    sourceSystem: "scheduler",
    sourceId: input.task.id,
    actionUrl: cadenceTaskHref(input.task),
    metadata: { companyName: input.companyName, channel: input.task.channel },
  })
}

export async function emitCadenceTaskCompletedNotification(
  admin: SupabaseClient,
  input: { task: GrowthCadenceTask; companyName: string; outcome: string },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.task.ownerUserId,
    leadId: input.task.leadId,
    notificationType: "cadence_task_completed",
    title: "Cadence task completed",
    body: `${input.companyName}: ${input.outcome.replace(/_/g, " ")}.`,
    sourceSystem: "scheduler",
    sourceId: input.task.id,
    actionUrl: cadenceTaskHref(input.task),
    metadata: { companyName: input.companyName, outcome: input.outcome },
  })
}

export async function emitCadenceTaskSkippedNotification(
  admin: SupabaseClient,
  input: { task: GrowthCadenceTask; companyName: string; reason: string },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.task.ownerUserId,
    leadId: input.task.leadId,
    notificationType: "cadence_task_skipped",
    title: "Cadence task skipped",
    body: `${input.companyName}: ${input.reason}`,
    sourceSystem: "scheduler",
    sourceId: input.task.id,
    actionUrl: cadenceTaskHref(input.task),
    metadata: { companyName: input.companyName, reason: input.reason },
  })
}
