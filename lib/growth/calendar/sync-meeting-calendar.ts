import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthCalendarConnectionWithFreshAccessToken } from "@/lib/growth/calendar/calendar-connection-service"
import {
  cancelGoogleCalendarEvent,
  createGoogleCalendarEvent,
  fetchGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from "@/lib/growth/calendar/google-calendar-client"
import {
  emitCalendarSyncFailedNotification,
  emitMeetingConflictNotification,
  emitMeetingSyncedNotification,
} from "@/lib/growth/calendar/calendar-notifications"
import { markGrowthCalendarConnectionSyncResult } from "@/lib/growth/calendar/calendar-connection-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { updateGrowthMeetingRow } from "@/lib/growth/meeting-intelligence/meeting-repository"
import type { GrowthMeeting } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"

export type SyncMeetingCalendarAction = "create" | "update" | "cancel"

export type SyncMeetingCalendarResult =
  | { ok: true; meeting: GrowthMeeting; action: SyncMeetingCalendarAction }
  | { ok: false; code: string; message: string }

function attendeeEmails(meeting: GrowthMeeting): string[] {
  return Array.isArray(meeting.attendeeEmails) ? meeting.attendeeEmails.filter(Boolean) : []
}

async function patchMeetingSyncState(
  admin: SupabaseClient,
  meetingId: string,
  patch: Record<string, unknown>,
): Promise<GrowthMeeting> {
  return updateGrowthMeetingRow(admin, meetingId, {
    ...patch,
    calendar_last_sync_at: new Date().toISOString(),
  })
}

export async function syncGrowthMeetingToGoogleCalendar(
  admin: SupabaseClient,
  input: {
    meeting: GrowthMeeting
    actorUserId: string
    action: SyncMeetingCalendarAction
    confirm: boolean
    appOrigin: string
  },
): Promise<SyncMeetingCalendarResult> {
  if (!input.confirm) {
    return { ok: false, code: "confirmation_required", message: "Human confirmation is required before calendar sync." }
  }

  if (input.action !== "cancel" && !input.meeting.startAt) {
    return { ok: false, code: "schedule_required", message: "Set a start time before syncing to Google Calendar." }
  }

  const connection = await getGrowthCalendarConnectionWithFreshAccessToken(admin, input.actorUserId)
  if (!connection) {
    return { ok: false, code: "calendar_not_connected", message: "Connect Google Calendar in Growth Settings first." }
  }

  const lead = await fetchGrowthLeadById(admin, input.meeting.leadId)
  const companyName = lead?.companyName ?? "Lead"

  try {
    if (input.action === "create") {
      const created = await createGoogleCalendarEvent({
        accessToken: connection.accessToken,
        meeting: input.meeting,
        attendeeEmails: attendeeEmails(input.meeting),
        appOrigin: input.appOrigin,
        includeGoogleMeet:
          input.meeting.meetingLocationType === "google_meet" &&
          (input.meeting.autoCreateMeetingLink ?? true),
        locationLabel: input.meeting.meetingLocationLabel,
        manualMeetingUrl: input.meeting.manualMeetingUrl,
      })

      const meeting = await patchMeetingSyncState(admin, input.meeting.id, {
        calendar_event_id: created.eventId,
        calendar_sync_status: "synced",
        calendar_sync_error: null,
        calendar_synced_at: new Date().toISOString(),
        meeting_url: created.meetingUrl ?? input.meeting.meetingUrl ?? input.meeting.manualMeetingUrl,
        source: input.meeting.source === "reply_intent" ? "reply_intent" : input.meeting.source,
        status: input.meeting.status === "proposed" ? "scheduled" : input.meeting.status,
        scheduled_at: input.meeting.scheduledAt ?? new Date().toISOString(),
      })

      await markGrowthCalendarConnectionSyncResult(admin, connection.id, { syncHealth: "healthy", lastSyncError: null })
      await emitMeetingSyncedNotification(admin, {
        leadId: meeting.leadId,
        meetingId: meeting.id,
        ownerUserId: meeting.ownerUserId,
        companyName,
        action: "create",
      })

      return { ok: true, meeting, action: "create" }
    }

    if (!input.meeting.calendarEventId) {
      return { ok: false, code: "missing_event", message: "Meeting is not linked to a Google Calendar event yet." }
    }

    if (input.action === "update") {
      const remote = await fetchGoogleCalendarEvent({
        accessToken: connection.accessToken,
        eventId: input.meeting.calendarEventId,
      })
      if (!remote) {
        const meeting = await patchMeetingSyncState(admin, input.meeting.id, {
          calendar_sync_status: "conflict",
          calendar_sync_error: "Remote calendar event was deleted.",
        })
        await emitMeetingConflictNotification(admin, {
          leadId: meeting.leadId,
          meetingId: meeting.id,
          ownerUserId: meeting.ownerUserId,
          companyName,
          reason: "Remote calendar event was deleted.",
        })
        return { ok: false, code: "calendar_conflict", message: "Remote calendar event was deleted." }
      }

      const updated = await updateGoogleCalendarEvent({
        accessToken: connection.accessToken,
        eventId: input.meeting.calendarEventId,
        meeting: input.meeting,
        attendeeEmails: attendeeEmails(input.meeting),
        appOrigin: input.appOrigin,
      })

      const meeting = await patchMeetingSyncState(admin, input.meeting.id, {
        calendar_sync_status: "synced",
        calendar_sync_error: null,
        meeting_url: updated.meetingUrl ?? input.meeting.meetingUrl,
      })

      await markGrowthCalendarConnectionSyncResult(admin, connection.id, { syncHealth: "healthy", lastSyncError: null })
      await emitMeetingSyncedNotification(admin, {
        leadId: meeting.leadId,
        meetingId: meeting.id,
        ownerUserId: meeting.ownerUserId,
        companyName,
        action: "update",
      })
      return { ok: true, meeting, action: "update" }
    }

    await cancelGoogleCalendarEvent({
      accessToken: connection.accessToken,
      eventId: input.meeting.calendarEventId,
    })

    const meeting = await patchMeetingSyncState(admin, input.meeting.id, {
      calendar_sync_status: "synced",
      calendar_sync_error: null,
    })

    await markGrowthCalendarConnectionSyncResult(admin, connection.id, { syncHealth: "healthy", lastSyncError: null })
    await emitMeetingSyncedNotification(admin, {
      leadId: meeting.leadId,
      meetingId: meeting.id,
      ownerUserId: meeting.ownerUserId,
      companyName,
      action: "cancel",
    })
    return { ok: true, meeting, action: "cancel" }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Calendar sync failed."
    const code =
      e instanceof Error && "code" in e && (e as Error & { code?: string }).code === "calendar_conflict"
        ? "calendar_conflict"
        : "calendar_sync_failed"

    const status = code === "calendar_conflict" ? "conflict" : "failed"
    await patchMeetingSyncState(admin, input.meeting.id, {
      calendar_sync_status: status,
      calendar_sync_error: message,
    })
    await markGrowthCalendarConnectionSyncResult(admin, connection.id, {
      syncHealth: code === "calendar_conflict" ? "degraded" : "failed",
      lastSyncError: message,
    })

    if (code === "calendar_conflict") {
      await emitMeetingConflictNotification(admin, {
        leadId: input.meeting.leadId,
        meetingId: input.meeting.id,
        ownerUserId: input.meeting.ownerUserId,
        companyName,
        reason: message,
      })
    } else {
      await emitCalendarSyncFailedNotification(admin, {
        leadId: input.meeting.leadId,
        meetingId: input.meeting.id,
        ownerUserId: input.meeting.ownerUserId,
        companyName,
        reason: message,
      })
    }

    return { ok: false, code, message }
  }
}
