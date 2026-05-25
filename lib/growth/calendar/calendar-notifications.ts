import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { emitGrowthNotification } from "@/lib/growth/notifications/emit-growth-notification"
import { growthMeetingScheduleHref } from "@/lib/growth/meeting-intelligence/meeting-intelligence-notifications"

export async function emitCalendarSyncFailedNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    meetingId: string
    ownerUserId: string | null
    companyName: string
    reason: string
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    notificationType: "calendar_sync_failed",
    title: "Calendar sync failed",
    body: `${input.companyName}: ${input.reason}`,
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    sourceSystem: "intelligence",
    sourceId: input.meetingId,
    actionUrl: growthMeetingScheduleHref({ leadId: input.leadId, meetingId: input.meetingId }),
    metadata: { meetingId: input.meetingId, reason: input.reason },
  })
}

export async function emitMeetingSyncedNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    meetingId: string
    ownerUserId: string | null
    companyName: string
    action: "create" | "update" | "cancel"
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    notificationType: "meeting_synced",
    title: "Meeting synced to Google Calendar",
    body: `${input.companyName} — ${input.action} confirmed by operator.`,
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    sourceSystem: "intelligence",
    sourceId: input.meetingId,
    actionUrl: growthMeetingScheduleHref({ leadId: input.leadId, meetingId: input.meetingId }),
    metadata: { meetingId: input.meetingId, action: input.action },
  })
}

export async function emitMeetingConflictNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    meetingId: string
    ownerUserId: string | null
    companyName: string
    reason: string
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    notificationType: "meeting_conflict",
    title: "Meeting calendar conflict",
    body: `${input.companyName}: ${input.reason}`,
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    sourceSystem: "intelligence",
    sourceId: input.meetingId,
    actionUrl: growthMeetingScheduleHref({ leadId: input.leadId, meetingId: input.meetingId }),
    metadata: { meetingId: input.meetingId, reason: input.reason },
  })
}
