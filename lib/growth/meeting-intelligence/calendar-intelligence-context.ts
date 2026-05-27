import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assembleCalendarEventIntelligence } from "@/lib/growth/meeting-intelligence/calendar-event-intelligence"
import type { GrowthCalendarEventIntelligence } from "@/lib/growth/meeting-intelligence/calendar-event-intelligence-types"
import {
  fetchGrowthMeetingById,
  listGrowthMeetingsForLead,
} from "@/lib/growth/meeting-intelligence/meeting-repository"
import { gatherMeetingPrepBundleForMeeting } from "@/lib/growth/meeting-intelligence/meeting-prep-context"

function leadHasFollowUpMeeting(
  leadMeetings: Awaited<ReturnType<typeof listGrowthMeetingsForLead>>,
  currentMeetingId: string,
): boolean {
  const now = Date.now()
  return leadMeetings.some(
    (meeting) =>
      meeting.id !== currentMeetingId &&
      (meeting.status === "scheduled" || meeting.status === "proposed") &&
      meeting.startAt != null &&
      Date.parse(meeting.startAt) >= now,
  )
}

export async function gatherCalendarEventIntelligence(
  admin: SupabaseClient,
  meetingId: string,
): Promise<GrowthCalendarEventIntelligence | null> {
  const meeting = await fetchGrowthMeetingById(admin, meetingId)
  if (!meeting) return null

  const prep = await gatherMeetingPrepBundleForMeeting(admin, meeting)
  if (!prep) return null

  const leadMeetings =
    meeting.status === "completed" ? await listGrowthMeetingsForLead(admin, meeting.leadId, 20) : []

  return assembleCalendarEventIntelligence({
    meeting,
    prep,
    hasFollowUpMeeting: leadHasFollowUpMeeting(leadMeetings, meeting.id),
  })
}

export async function gatherCalendarIntelligenceBatch(
  admin: SupabaseClient,
  meetingIds: string[],
): Promise<GrowthCalendarEventIntelligence[]> {
  const uniqueIds = [...new Set(meetingIds)].slice(0, 50)
  const items = await Promise.all(uniqueIds.map((meetingId) => gatherCalendarEventIntelligence(admin, meetingId)))
  return items.filter((item): item is GrowthCalendarEventIntelligence => item != null)
}
