import "server-only"

import type { GrowthMeeting } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import { assertGrowthMeetingScheduleTimes, resolveGrowthMeetingTimezone } from "@/lib/growth/calendar/calendar-timezone"
import { buildGrowthLeadHref, buildGrowthOpportunityHref } from "@/lib/growth/navigation/growth-workspace-operator-links"

type GoogleCalendarEvent = {
  id?: string
  etag?: string
  htmlLink?: string
  hangoutLink?: string
  status?: string
  summary?: string
  description?: string
  start?: { dateTime?: string; date?: string; timeZone?: string }
  end?: { dateTime?: string; date?: string; timeZone?: string }
  attendees?: Array<{ email?: string; organizer?: boolean; responseStatus?: string }>
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>
  }
}

export type GoogleCalendarListedEvent = {
  eventId: string
  etag: string | null
  status: string | null
  title: string
  startAt: string | null
  endAt: string | null
  attendeeEmails: string[]
  meetingUrl: string | null
  canceled: boolean
}

function extractMeetUrl(event: GoogleCalendarEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink
  const meetEntry = event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")
  return meetEntry?.uri ?? null
}

function buildEventDescription(meeting: GrowthMeeting, leadLink: string, opportunityLink: string | null): string {
  const lines = [
    meeting.notes?.trim() || "Growth Engine meeting — human confirmed.",
    `Lead: ${leadLink}`,
  ]
  if (opportunityLink) lines.push(`Opportunity: ${opportunityLink}`)
  if (meeting.nextAction) lines.push(`Next action: ${meeting.nextAction}`)
  return lines.join("\n")
}

export async function fetchGoogleAccountProfile(accessToken: string): Promise<{
  email: string | null
  hostedDomain: string | null
}> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return { email: null, hostedDomain: null }
  const json = (await res.json()) as { email?: string; hd?: string }
  return { email: json.email ?? null, hostedDomain: json.hd ?? null }
}

export async function createGoogleCalendarEvent(input: {
  accessToken: string
  meeting: GrowthMeeting
  attendeeEmails?: string[]
  appOrigin: string
  includeGoogleMeet?: boolean
  locationLabel?: string | null
  manualMeetingUrl?: string | null
}): Promise<{ eventId: string; meetingUrl: string | null; etag: string | null }> {
  const { startAt, endAt } = assertGrowthMeetingScheduleTimes({
    startAt: input.meeting.startAt!,
    endAt: input.meeting.endAt,
  })
  const timezone = resolveGrowthMeetingTimezone(input.meeting.timezone)
  const leadLink = `${input.appOrigin}${buildGrowthLeadHref(input.meeting.leadId, { focus: "meetings", highlight: input.meeting.id })}`
  const opportunityLink = input.meeting.opportunityId
    ? `${input.appOrigin}${buildGrowthOpportunityHref({ opportunityId: input.meeting.opportunityId })}`
    : null

  const attendees = (input.attendeeEmails ?? [])
    .map((email) => email.trim())
    .filter(Boolean)
    .map((email) => ({ email }))

  const body: Record<string, unknown> = {
    summary: input.meeting.title,
    description: buildEventDescription(input.meeting, leadLink, opportunityLink),
    start: { dateTime: startAt, timeZone: timezone },
    end: { dateTime: endAt, timeZone: timezone },
    attendees,
  }

  if (input.includeGoogleMeet !== false) {
    body.conferenceData = {
      createRequest: {
        requestId: `growth-${input.meeting.id}-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    }
  }

  const locationText =
    input.locationLabel?.trim() ||
    input.manualMeetingUrl?.trim() ||
    input.meeting.manualMeetingUrl?.trim() ||
    input.meeting.meetingLocationLabel?.trim() ||
    null
  if (locationText) {
    body.location = locationText
  }

  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const json = (await res.json()) as GoogleCalendarEvent & { error?: { message?: string } }
  if (!res.ok || !json.id) {
    throw new Error(json.error?.message ?? `Google Calendar create failed (${res.status})`)
  }

  return {
    eventId: json.id,
    meetingUrl: extractMeetUrl(json),
    etag: json.etag ?? null,
  }
}

export async function updateGoogleCalendarEvent(input: {
  accessToken: string
  eventId: string
  meeting: GrowthMeeting
  attendeeEmails?: string[]
  appOrigin: string
}): Promise<{ meetingUrl: string | null; etag: string | null }> {
  const { startAt, endAt } = assertGrowthMeetingScheduleTimes({
    startAt: input.meeting.startAt!,
    endAt: input.meeting.endAt,
  })
  const timezone = resolveGrowthMeetingTimezone(input.meeting.timezone)
  const leadLink = `${input.appOrigin}${buildGrowthLeadHref(input.meeting.leadId, { focus: "meetings", highlight: input.meeting.id })}`
  const opportunityLink = input.meeting.opportunityId
    ? `${input.appOrigin}${buildGrowthOpportunityHref({ opportunityId: input.meeting.opportunityId })}`
    : null

  const body = {
    summary: input.meeting.title,
    description: buildEventDescription(input.meeting, leadLink, opportunityLink),
    start: { dateTime: startAt, timeZone: timezone },
    end: { dateTime: endAt, timeZone: timezone },
    attendees: (input.attendeeEmails ?? []).map((email) => ({ email: email.trim() })).filter((entry) => entry.email),
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(input.eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  )

  const json = (await res.json()) as GoogleCalendarEvent & { error?: { message?: string } }
  if (!res.ok) {
    if (res.status === 409) {
      const conflict = new Error("Calendar event conflict detected.")
      ;(conflict as Error & { code?: string }).code = "calendar_conflict"
      throw conflict
    }
    throw new Error(json.error?.message ?? `Google Calendar update failed (${res.status})`)
  }

  return { meetingUrl: extractMeetUrl(json), etag: json.etag ?? null }
}

export async function cancelGoogleCalendarEvent(input: {
  accessToken: string
  eventId: string
}): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(input.eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${input.accessToken}` },
    },
  )
  if (res.status === 404) return
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(json.error?.message ?? `Google Calendar cancel failed (${res.status})`)
  }
}

export async function fetchGoogleCalendarEvent(input: {
  accessToken: string
  eventId: string
}): Promise<GoogleCalendarEvent | null> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(input.eventId)}`,
    { headers: { Authorization: `Bearer ${input.accessToken}` } },
  )
  if (res.status === 404) return null
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(json.error?.message ?? `Google Calendar fetch failed (${res.status})`)
  }
  return (await res.json()) as GoogleCalendarEvent
}

function mapListedEvent(event: GoogleCalendarEvent): GoogleCalendarListedEvent | null {
  if (!event.id) return null
  const startAt = event.start?.dateTime ?? (event.start?.date ? `${event.start.date}T00:00:00.000Z` : null)
  const endAt = event.end?.dateTime ?? (event.end?.date ? `${event.end.date}T00:00:00.000Z` : null)
  const attendeeEmails = (event.attendees ?? [])
    .map((entry) => entry.email?.trim().toLowerCase())
    .filter(Boolean) as string[]
  return {
    eventId: event.id,
    etag: event.etag ?? null,
    status: event.status ?? null,
    title: event.summary?.trim() || "Calendar event",
    startAt,
    endAt,
    attendeeEmails,
    meetingUrl: extractMeetUrl(event),
    canceled: event.status === "cancelled",
  }
}

export async function listGoogleCalendarEvents(input: {
  accessToken: string
  timeMin: string
  timeMax: string
  maxResults?: number
}): Promise<GoogleCalendarListedEvent[]> {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: input.timeMin,
    timeMax: input.timeMax,
    maxResults: String(input.maxResults ?? 250),
  })

  const events: GoogleCalendarListedEvent[] = []
  let pageToken: string | undefined

  do {
    if (pageToken) params.set("pageToken", pageToken)
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${input.accessToken}` } },
    )
    const json = (await res.json()) as {
      items?: GoogleCalendarEvent[]
      nextPageToken?: string
      error?: { message?: string }
    }
    if (!res.ok) {
      throw new Error(json.error?.message ?? `Google Calendar list failed (${res.status})`)
    }
    for (const item of json.items ?? []) {
      const mapped = mapListedEvent(item)
      if (mapped) events.push(mapped)
    }
    pageToken = json.nextPageToken
  } while (pageToken && events.length < (input.maxResults ?? 250))

  return events
}

export async function fetchGoogleCalendarBusyIntervals(input: {
  accessToken: string
  timeMin: string
  timeMax: string
  timezone: string
}): Promise<Array<{ start: string; end: string }>> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: input.timeMin,
      timeMax: input.timeMax,
      timeZone: input.timezone,
      items: [{ id: "primary" }],
    }),
  })
  const json = (await res.json()) as {
    calendars?: Record<string, { busy?: Array<{ start?: string; end?: string }> }>
    error?: { message?: string }
  }
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Google Calendar freeBusy failed (${res.status})`)
  }
  const busy = json.calendars?.primary?.busy ?? []
  return busy
    .filter((entry) => entry.start && entry.end)
    .map((entry) => ({ start: entry.start!, end: entry.end! }))
}
