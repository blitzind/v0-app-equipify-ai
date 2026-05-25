import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthCalendarConnectionWithFreshAccessToken } from "@/lib/growth/calendar/calendar-connection-service"
import { fetchGoogleCalendarEvent } from "@/lib/growth/calendar/google-calendar-client"
import { syncGrowthMeetingToGoogleCalendar } from "@/lib/growth/calendar/sync-meeting-calendar"
import type { GrowthCalendarConflictMeeting } from "@/lib/growth/calendar/calendar-sync-types"
import {
  attachCompanyNamesToMeetings,
  fetchGrowthMeetingById,
  listGrowthMeetingsWithCalendarConflict,
  updateGrowthMeetingRow,
} from "@/lib/growth/meeting-intelligence/meeting-repository"

export type ResolveCalendarConflictAction = "keep_growth" | "accept_google" | "dismiss"

export type ResolveCalendarConflictResult =
  | { ok: true; meetingId: string }
  | { ok: false; code: string; message: string }

export async function listGrowthCalendarConflictMeetings(
  admin: SupabaseClient,
  ownerUserId: string,
): Promise<GrowthCalendarConflictMeeting[]> {
  const meetings = await attachCompanyNamesToMeetings(
    admin,
    await listGrowthMeetingsWithCalendarConflict(admin, ownerUserId),
  )
  return meetings.map((meeting) => ({
    meetingId: meeting.id,
    leadId: meeting.leadId,
    companyName: meeting.companyName ?? null,
    title: meeting.title,
    startAt: meeting.startAt,
    calendarEventId: meeting.calendarEventId,
    calendarSyncError: meeting.calendarSyncError,
    calendarLastSyncAt: meeting.calendarLastSyncAt,
  }))
}

export async function resolveGrowthCalendarConflict(
  admin: SupabaseClient,
  input: {
    meetingId: string
    actorUserId: string
    action: ResolveCalendarConflictAction
    appOrigin: string
  },
): Promise<ResolveCalendarConflictResult> {
  const meeting = await fetchGrowthMeetingById(admin, input.meetingId)
  if (!meeting) return { ok: false, code: "not_found", message: "Meeting not found." }
  if (meeting.calendarSyncStatus !== "conflict") {
    return { ok: false, code: "not_conflict", message: "Meeting is not in conflict state." }
  }

  if (input.action === "dismiss") {
    await updateGrowthMeetingRow(admin, meeting.id, {
      calendar_sync_status: "synced",
      calendar_sync_error: null,
      calendar_last_sync_at: new Date().toISOString(),
    })
    return { ok: true, meetingId: meeting.id }
  }

  if (input.action === "keep_growth") {
    const result = await syncGrowthMeetingToGoogleCalendar(admin, {
      meeting,
      actorUserId: input.actorUserId,
      action: meeting.calendarEventId ? "update" : "create",
      confirm: true,
      appOrigin: input.appOrigin,
    })
    if (!result.ok) return { ok: false, code: result.code, message: result.message }
    return { ok: true, meetingId: meeting.id }
  }

  if (!meeting.calendarEventId) {
    return { ok: false, code: "missing_event", message: "Meeting is not linked to a Google Calendar event." }
  }

  const connection = await getGrowthCalendarConnectionWithFreshAccessToken(admin, input.actorUserId)
  if (!connection) {
    return { ok: false, code: "calendar_not_connected", message: "Connect Google Calendar first." }
  }

  const remote = await fetchGoogleCalendarEvent({
    accessToken: connection.accessToken,
    eventId: meeting.calendarEventId,
  })
  if (!remote) {
    return { ok: false, code: "remote_missing", message: "Google Calendar event no longer exists." }
  }

  const startAt = remote.start?.dateTime ?? remote.start?.date ?? meeting.startAt
  const endAt = remote.end?.dateTime ?? remote.end?.date ?? meeting.endAt
  const attendeeEmails = (remote.attendees ?? [])
    .map((entry) => entry.email?.trim())
    .filter(Boolean) as string[]
  const meetingUrl =
    remote.hangoutLink ??
    remote.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ??
    meeting.meetingUrl

  await updateGrowthMeetingRow(admin, meeting.id, {
    title: remote.summary?.trim() || meeting.title,
    start_at: startAt,
    end_at: endAt,
    attendee_emails: attendeeEmails.length > 0 ? attendeeEmails : meeting.attendeeEmails,
    meeting_url: meetingUrl,
    calendar_sync_status: "synced",
    calendar_sync_error: null,
    calendar_last_sync_at: new Date().toISOString(),
    status: remote.status === "cancelled" ? "canceled" : meeting.status,
    canceled_at: remote.status === "cancelled" ? new Date().toISOString() : meeting.canceledAt,
  })

  return { ok: true, meetingId: meeting.id }
}
