import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { emitGrowthNotification } from "@/lib/growth/notifications/emit-growth-notification"

export function growthMeetingScheduleHref(input: {
  leadId: string
  meetingId?: string
  replyId?: string
}): string {
  const params = new URLSearchParams({ open: input.leadId, focus: "meetings" })
  if (input.meetingId) params.set("highlight", input.meetingId)
  if (input.replyId) params.set("replyId", input.replyId)
  return `/admin/growth/leads?${params.toString()}`
}

export function growthMeetingDashboardHref(meetingId?: string): string {
  if (meetingId) return `/admin/growth/meetings?meetingId=${meetingId}`
  return "/admin/growth/meetings"
}

export async function emitMeetingRequestedNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    meetingId: string
    ownerUserId: string | null
    companyName: string
    replyId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    notificationType: "meeting_requested",
    title: "Meeting request needs scheduling",
    body: `${input.companyName} requested a meeting — confirm and schedule.`,
    sourceSystem: "outreach",
    sourceId: input.meetingId,
    actionUrl: growthMeetingScheduleHref({
      leadId: input.leadId,
      meetingId: input.meetingId,
      replyId: input.replyId ?? undefined,
    }),
    metadata: { companyName: input.companyName, replyId: input.replyId ?? null },
  })
}

export async function emitMeetingScheduledNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    meetingId: string
    ownerUserId: string | null
    companyName: string
    startAt: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    notificationType: "meeting_scheduled",
    title: "Meeting scheduled",
    body: input.startAt
      ? `${input.companyName} meeting scheduled for ${new Date(input.startAt).toLocaleString()}.`
      : `${input.companyName} meeting marked scheduled.`,
    sourceSystem: "scheduler",
    sourceId: input.meetingId,
    actionUrl: growthMeetingScheduleHref({ leadId: input.leadId, meetingId: input.meetingId }),
    metadata: { companyName: input.companyName, startAt: input.startAt },
  })
}

export async function emitMeetingStartingSoonNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    meetingId: string
    ownerUserId: string | null
    companyName: string
    startAt: string
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    notificationType: "meeting_starting_soon",
    title: "Meeting starting soon",
    body: `${input.companyName} meeting starts at ${new Date(input.startAt).toLocaleTimeString()}.`,
    sourceSystem: "scheduler",
    sourceId: input.meetingId,
    actionUrl: growthMeetingScheduleHref({ leadId: input.leadId, meetingId: input.meetingId }),
    metadata: { companyName: input.companyName, startAt: input.startAt },
  })
}

export async function emitMeetingNoShowNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    meetingId: string
    ownerUserId: string | null
    companyName: string
    reason?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    notificationType: "meeting_no_show",
    title: "Meeting no-show",
    body: `${input.companyName} did not attend the scheduled meeting.`,
    sourceSystem: "scheduler",
    sourceId: input.meetingId,
    actionUrl: growthMeetingScheduleHref({ leadId: input.leadId, meetingId: input.meetingId }),
    metadata: { companyName: input.companyName, reason: input.reason ?? null },
  })
}

export async function emitPostMeetingFollowupDueNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    meetingId: string
    ownerUserId: string | null
    companyName: string
    followUpDueAt: string
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    notificationType: "post_meeting_followup_due",
    title: "Post-meeting follow-up due",
    body: `Follow-up due for ${input.companyName} after recent meeting.`,
    sourceSystem: "scheduler",
    sourceId: input.meetingId,
    actionUrl: growthMeetingScheduleHref({ leadId: input.leadId, meetingId: input.meetingId }),
    metadata: { companyName: input.companyName, followUpDueAt: input.followUpDueAt },
  })
}

export async function emitMeetingOutcomeMissingNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    meetingId: string
    ownerUserId: string | null
    companyName: string
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    notificationType: "meeting_outcome_missing",
    title: "Meeting outcome missing",
    body: `${input.companyName} meeting completed — record outcome and next action.`,
    sourceSystem: "scheduler",
    sourceId: input.meetingId,
    actionUrl: growthMeetingScheduleHref({ leadId: input.leadId, meetingId: input.meetingId }),
    metadata: { companyName: input.companyName },
  })
}
