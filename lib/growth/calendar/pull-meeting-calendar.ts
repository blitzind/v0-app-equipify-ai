import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthCalendarConnectionWithFreshAccessToken } from "@/lib/growth/calendar/calendar-connection-service"
import { markGrowthCalendarConnectionSyncResult } from "@/lib/growth/calendar/calendar-connection-repository"
import { emitMeetingConflictNotification } from "@/lib/growth/calendar/calendar-notifications"
import {
  completeGrowthCalendarSyncRun,
  insertGrowthCalendarSyncRun,
} from "@/lib/growth/calendar/calendar-sync-run-repository"
import type { GrowthCalendarSyncRunSummary, GrowthCalendarSyncTriggerType } from "@/lib/growth/calendar/calendar-sync-types"
import {
  listGoogleCalendarEvents,
  type GoogleCalendarListedEvent,
} from "@/lib/growth/calendar/google-calendar-client"
import { createGrowthLead } from "@/lib/growth/lead-repository"
import { createGrowthMeeting } from "@/lib/growth/meeting-intelligence/mutate-meeting"
import {
  fetchGrowthMeetingByCalendarEventId,
  listGrowthMeetingsForOwnerInTimeRange,
  updateGrowthMeetingRow,
} from "@/lib/growth/meeting-intelligence/meeting-repository"
import type { GrowthMeeting } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import { resolveOutboundLeadByEmail } from "@/lib/growth/outbound/resolve-lead-by-email"

export type PullGrowthCalendarResult =
  | { ok: true; run: GrowthCalendarSyncRunSummary }
  | { ok: false; code: string; message: string; run?: GrowthCalendarSyncRunSummary }

const MATCH_WINDOW_MS = 5 * 60 * 1000

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function timesClose(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= MATCH_WINDOW_MS
}

function attendeeOverlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false
  const setB = new Set(b.map((email) => email.toLowerCase()))
  return a.some((email) => setB.has(email.toLowerCase()))
}

function detectConflict(local: GrowthMeeting, remote: GoogleCalendarListedEvent): string | null {
  if (remote.canceled && local.status !== "canceled") {
    return "Google Calendar event was cancelled."
  }
  if (local.startAt && remote.startAt && !timesClose(local.startAt, remote.startAt)) {
    return "Start time differs between Growth and Google Calendar."
  }
  if (local.endAt && remote.endAt && !timesClose(local.endAt, remote.endAt)) {
    return "End time differs between Growth and Google Calendar."
  }
  if (normalizeTitle(local.title) !== normalizeTitle(remote.title)) {
    return "Meeting title differs between Growth and Google Calendar."
  }
  return null
}

function safeAutoUpdatePatch(local: GrowthMeeting, remote: GoogleCalendarListedEvent): Record<string, unknown> | null {
  const conflict = detectConflict(local, remote)
  if (conflict) return null
  const patch: Record<string, unknown> = {
    calendar_sync_status: "synced",
    calendar_sync_error: null,
    calendar_last_sync_at: new Date().toISOString(),
  }
  if (remote.meetingUrl && !local.meetingUrl) patch.meeting_url = remote.meetingUrl
  if (remote.canceled && local.status !== "canceled") {
    patch.status = "canceled"
    patch.canceled_at = new Date().toISOString()
  }
  return patch
}

async function resolveLeadForRemoteEvent(
  admin: SupabaseClient,
  remote: GoogleCalendarListedEvent,
  ownerUserId: string,
): Promise<string | null> {
  const candidateEmail = remote.attendeeEmails[0]
  if (candidateEmail) {
    const resolved = await resolveOutboundLeadByEmail(admin, candidateEmail)
    if (resolved?.leadId) return resolved.leadId
    const lead = await createGrowthLead(admin, {
      companyName: remote.title.slice(0, 120) || "Calendar import",
      contactEmail: candidateEmail,
      contactName: null,
      sourceKind: "manual",
      sourceDetail: "google_calendar_pull",
      assignedTo: ownerUserId,
      createdBy: ownerUserId,
      notes: "Imported from Google Calendar pull sync.",
    })
    return lead.id
  }
  return null
}

function fallbackMatchMeeting(
  remote: GoogleCalendarListedEvent,
  candidates: GrowthMeeting[],
): GrowthMeeting | null {
  for (const meeting of candidates) {
    if (meeting.calendarEventId) continue
    if (!timesClose(meeting.startAt, remote.startAt)) continue
    if (normalizeTitle(meeting.title) !== normalizeTitle(remote.title)) continue
    if (!attendeeOverlap(meeting.attendeeEmails, remote.attendeeEmails)) continue
    return meeting
  }
  return null
}

export async function pullGrowthMeetingsFromGoogleCalendar(
  admin: SupabaseClient,
  input: {
    actorUserId: string
    confirm: boolean
    timeMin?: string
    timeMax?: string
    triggerType?: GrowthCalendarSyncTriggerType
  },
): Promise<PullGrowthCalendarResult> {
  if (!input.confirm) {
    return {
      ok: false,
      code: "confirmation_required",
      message: "Human confirmation is required before calendar pull sync.",
    }
  }

  const connection = await getGrowthCalendarConnectionWithFreshAccessToken(admin, input.actorUserId)
  if (!connection) {
    return { ok: false, code: "calendar_not_connected", message: "Connect Google Calendar in Growth Settings first." }
  }

  const now = new Date()
  const timeMin = input.timeMin ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const timeMax = input.timeMax ?? new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()

  const run = await insertGrowthCalendarSyncRun(admin, {
    userId: input.actorUserId,
    connectionId: connection.id,
    triggerType: input.triggerType ?? "manual_pull",
  })

  let eventsFetched = 0
  let eventsMatched = 0
  let eventsCreated = 0
  let eventsUpdated = 0
  let eventsSynced = 0
  let conflictsDetected = 0

  try {
    const remoteEvents = await listGoogleCalendarEvents({
      accessToken: connection.accessToken,
      timeMin,
      timeMax,
    })
    eventsFetched = remoteEvents.length

    const localMeetings = await listGrowthMeetingsForOwnerInTimeRange(admin, input.actorUserId, timeMin, timeMax)

    for (const remote of remoteEvents) {
      if (!remote.startAt) continue

      let meeting =
        (await fetchGrowthMeetingByCalendarEventId(admin, remote.eventId)) ??
        fallbackMatchMeeting(remote, localMeetings)

      if (meeting) {
        eventsMatched += 1
        const conflictReason = detectConflict(meeting, remote)
        if (conflictReason) {
          conflictsDetected += 1
          await updateGrowthMeetingRow(admin, meeting.id, {
            calendar_event_id: meeting.calendarEventId ?? remote.eventId,
            calendar_sync_status: "conflict",
            calendar_sync_error: conflictReason,
            calendar_last_sync_at: new Date().toISOString(),
          })
          await emitMeetingConflictNotification(admin, {
            leadId: meeting.leadId,
            meetingId: meeting.id,
            ownerUserId: meeting.ownerUserId,
            companyName: meeting.companyName ?? "Lead",
            reason: conflictReason,
          })
          continue
        }

        const patch = safeAutoUpdatePatch(meeting, remote)
        if (patch) {
          await updateGrowthMeetingRow(admin, meeting.id, {
            ...patch,
            calendar_event_id: meeting.calendarEventId ?? remote.eventId,
          })
          eventsUpdated += 1
          eventsSynced += 1
        }
        continue
      }

      const leadId = await resolveLeadForRemoteEvent(admin, remote, input.actorUserId)
      if (!leadId) continue

      const created = await createGrowthMeeting(admin, {
        leadId,
        title: remote.title,
        status: remote.canceled ? "canceled" : "scheduled",
        startAt: remote.startAt,
        endAt: remote.endAt,
        source: "calendar_sync",
        provider: "google_meet",
        calendarEventId: remote.eventId,
        meetingUrl: remote.meetingUrl,
        attendeeEmails: remote.attendeeEmails,
        ownerUserId: input.actorUserId,
        actor: { userId: input.actorUserId },
      })
      if (created.ok) {
        eventsCreated += 1
        eventsSynced += 1
        await updateGrowthMeetingRow(admin, created.meeting.id, {
          calendar_sync_status: "synced",
          calendar_synced_at: new Date().toISOString(),
          calendar_last_sync_at: new Date().toISOString(),
        })
      }
    }

    await markGrowthCalendarConnectionSyncResult(admin, connection.id, {
      syncHealth: conflictsDetected > 0 ? "degraded" : "healthy",
      lastSyncError: conflictsDetected > 0 ? `${conflictsDetected} sync conflict(s) detected.` : null,
    })

    const completed = await completeGrowthCalendarSyncRun(admin, run.id, {
      status: "completed",
      eventsFetched,
      eventsMatched,
      eventsCreated,
      eventsUpdated,
      eventsSynced,
      conflictsDetected,
    })

    return { ok: true, run: completed }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Calendar pull sync failed."
    await markGrowthCalendarConnectionSyncResult(admin, connection.id, {
      syncHealth: "failed",
      lastSyncError: message,
    })
    const failed = await completeGrowthCalendarSyncRun(admin, run.id, {
      status: "failed",
      eventsFetched,
      eventsMatched,
      eventsCreated,
      eventsUpdated,
      eventsSynced,
      conflictsDetected,
      syncError: message,
    })
    return { ok: false, code: "calendar_pull_failed", message, run: failed }
  }
}

export async function forceGrowthCalendarSync(
  admin: SupabaseClient,
  input: { actorUserId: string; confirm: boolean },
): Promise<PullGrowthCalendarResult> {
  if (!input.confirm) {
    return { ok: false, code: "confirmation_required", message: "Human confirmation is required before force sync." }
  }

  const connection = await getGrowthCalendarConnectionWithFreshAccessToken(admin, input.actorUserId)
  if (!connection) {
    return { ok: false, code: "calendar_not_connected", message: "Connect Google Calendar in Growth Settings first." }
  }

  return pullGrowthMeetingsFromGoogleCalendar(admin, {
    actorUserId: input.actorUserId,
    confirm: true,
    triggerType: "manual_force",
  })
}
