import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { emitGrowthNotification } from "@/lib/growth/notifications/emit-growth-notification"
import { growthMeetingScheduleHref } from "@/lib/growth/meeting-intelligence/process-meeting-intelligence"
import type { GrowthReplyIntent, GrowthReplyPriority } from "@/lib/growth/reply-intelligence/reply-intent-types"
import { isReplyOverdue } from "@/lib/growth/reply-intelligence/reply-sla-tracker"

function replyInboxHref(replyId: string): string {
  return `/admin/growth/replies?replyId=${replyId}`
}

export async function emitReplyWaitingNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    replyId: string
    ownerUserId: string | null
    companyName: string
    intent: GrowthReplyIntent
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    notificationType: "reply_waiting",
    title: "Inbound reply waiting",
    body: `${input.companyName} replied (${input.intent.replace(/_/g, " ")}).`,
    sourceSystem: "outreach",
    sourceId: input.replyId,
    actionUrl: replyInboxHref(input.replyId),
    metadata: { intent: input.intent, companyName: input.companyName },
  })
}

export async function emitReplyOverdueNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    replyId: string
    ownerUserId: string | null
    companyName: string
    priority: GrowthReplyPriority
    receivedAt: string
  },
): Promise<void> {
  if (!isReplyOverdue(input.receivedAt, input.priority)) return
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    notificationType: "reply_overdue",
    title: "Reply response overdue",
    body: `${input.companyName} reply is past SLA (${input.priority}).`,
    sourceSystem: "outreach",
    sourceId: input.replyId,
    actionUrl: replyInboxHref(input.replyId),
    metadata: { priority: input.priority, companyName: input.companyName },
  })
}

export async function emitMeetingRequestReceivedNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    replyId: string
    ownerUserId: string | null
    companyName: string
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    notificationType: "meeting_request_received",
    title: "Meeting request received",
    body: `${input.companyName} requested a meeting.`,
    sourceSystem: "outreach",
    sourceId: input.replyId,
    actionUrl: growthMeetingScheduleHref({ leadId: input.leadId, replyId: input.replyId }),
    metadata: { companyName: input.companyName },
  })
}

export async function emitReplyCompetitorMentionedNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    replyId: string
    ownerUserId: string | null
    companyName: string
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    notificationType: "competitor_mentioned",
    title: "Competitor mentioned in reply",
    body: `${input.companyName} mentioned a competitor in their reply.`,
    sourceSystem: "outreach",
    sourceId: input.replyId,
    actionUrl: replyInboxHref(input.replyId),
    metadata: { companyName: input.companyName },
  })
}

export async function emitHighPriorityReplyNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    replyId: string
    ownerUserId: string | null
    companyName: string
    priority: GrowthReplyPriority
    intent: GrowthReplyIntent
  },
): Promise<void> {
  if (input.priority !== "critical" && input.priority !== "high") return
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    notificationType: "high_priority_reply",
    title: "High-priority inbound reply",
    body: `${input.companyName}: ${input.intent.replace(/_/g, " ")} (${input.priority}).`,
    sourceSystem: "outreach",
    sourceId: input.replyId,
    actionUrl: replyInboxHref(input.replyId),
    metadata: { priority: input.priority, intent: input.intent, companyName: input.companyName },
  })
}

export async function emitOwnerResponseGapNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    replyId: string
    ownerUserId: string | null
    companyName: string
    gapMs: number
  },
): Promise<void> {
  if (!input.ownerUserId || input.gapMs < 24 * 60 * 60 * 1000) return
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    notificationType: "owner_response_gap",
    title: "Owner response gap",
    body: `${input.companyName} reply has been waiting on owner action.`,
    sourceSystem: "outreach",
    sourceId: input.replyId,
    actionUrl: replyInboxHref(input.replyId),
    metadata: { gapMs: input.gapMs, companyName: input.companyName },
  })
}

export async function emitUnassignedReplyAttentionNotification(
  admin: SupabaseClient,
  input: { leadId: string; replyId: string; companyName: string; priority: GrowthReplyPriority },
): Promise<void> {
  if (input.priority === "low") return
  await emitGrowthNotification(admin, {
    leadId: input.leadId,
    notificationType: "high_priority_unassigned",
    title: "Unassigned high-priority reply",
    body: `${input.companyName} replied and needs an owner.`,
    sourceSystem: "outreach",
    sourceId: input.replyId,
    actionUrl: `/admin/growth/ownership`,
    metadata: { companyName: input.companyName, priority: input.priority },
  })
}
