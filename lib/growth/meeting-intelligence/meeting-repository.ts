import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthMeeting,
  GrowthMeetingInboxView,
  GrowthMeetingProvider,
  GrowthMeetingSource,
  GrowthMeetingStatus,
} from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import { invalidateCanonicalDecisionCacheForLead } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"

const MEETING_SELECT =
  "id, lead_id, owner_user_id, opportunity_id, outbound_reply_id, realtime_call_session_id, title, status, start_at, end_at, source, provider, calendar_event_id, calendar_sync_status, calendar_sync_error, calendar_synced_at, calendar_last_sync_at, meeting_url, manual_meeting_url, meeting_location_type, meeting_location_label, auto_create_meeting_link, provider_connection_required, notes, attendee_emails, timezone, outcome, next_action, follow_up_due_at, no_show_reason, scheduled_at, completed_at, canceled_at, no_show_at, outcome_recorded_at, booking_page_id, meeting_candidate_id, account_playbook_id, source_attribution, created_by, created_at, updated_at"

type MeetingDbRow = {
  id: string
  lead_id: string
  owner_user_id: string | null
  opportunity_id: string | null
  outbound_reply_id: string | null
  realtime_call_session_id: string | null
  title: string
  status: string
  start_at: string | null
  end_at: string | null
  source: string
  provider: string | null
  calendar_event_id: string | null
  calendar_sync_status: string | null
  calendar_sync_error: string | null
  calendar_synced_at: string | null
  calendar_last_sync_at: string | null
  meeting_url: string | null
  manual_meeting_url: string | null
  meeting_location_type: string | null
  meeting_location_label: string | null
  auto_create_meeting_link: boolean | null
  provider_connection_required: boolean
  notes: string | null
  attendee_emails: string[] | null
  timezone: string
  outcome: string | null
  next_action: string | null
  follow_up_due_at: string | null
  no_show_reason: string | null
  scheduled_at: string | null
  completed_at: string | null
  canceled_at: string | null
  no_show_at: string | null
  outcome_recorded_at: string | null
  booking_page_id: string | null
  meeting_candidate_id: string | null
  account_playbook_id: string | null
  source_attribution: Record<string, unknown> | null
  created_by: string | null
  created_at: string
  updated_at: string
}

function meetingsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("meetings")
}

export function mapGrowthMeetingRow(row: MeetingDbRow): GrowthMeeting {
  return {
    id: row.id,
    leadId: row.lead_id,
    ownerUserId: row.owner_user_id,
    opportunityId: row.opportunity_id,
    outboundReplyId: row.outbound_reply_id,
    realtimeCallSessionId: row.realtime_call_session_id,
    title: row.title,
    status: row.status as GrowthMeetingStatus,
    startAt: row.start_at,
    endAt: row.end_at,
    source: row.source as GrowthMeetingSource,
    provider: (row.provider as GrowthMeetingProvider | null) ?? null,
    calendarEventId: row.calendar_event_id,
    calendarSyncStatus: (row.calendar_sync_status as GrowthMeeting["calendarSyncStatus"]) ?? null,
    calendarSyncError: row.calendar_sync_error,
    calendarSyncedAt: row.calendar_synced_at,
    calendarLastSyncAt: row.calendar_last_sync_at,
    meetingUrl: row.meeting_url,
    manualMeetingUrl: row.manual_meeting_url,
    meetingLocationType: (row.meeting_location_type as GrowthMeeting["meetingLocationType"]) ?? null,
    meetingLocationLabel: row.meeting_location_label,
    autoCreateMeetingLink: row.auto_create_meeting_link,
    providerConnectionRequired: row.provider_connection_required ?? false,
    notes: row.notes,
    attendeeEmails: row.attendee_emails ?? [],
    timezone: row.timezone ?? "UTC",
    outcome: row.outcome,
    nextAction: row.next_action,
    followUpDueAt: row.follow_up_due_at,
    noShowReason: row.no_show_reason,
    scheduledAt: row.scheduled_at,
    completedAt: row.completed_at,
    canceledAt: row.canceled_at,
    noShowAt: row.no_show_at,
    outcomeRecordedAt: row.outcome_recorded_at,
    bookingPageId: row.booking_page_id,
    meetingCandidateId: row.meeting_candidate_id,
    accountPlaybookId: row.account_playbook_id,
    sourceAttribution: row.source_attribution,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchGrowthMeetingById(
  admin: SupabaseClient,
  meetingId: string,
): Promise<GrowthMeeting | null> {
  const { data, error } = await meetingsTable(admin).select(MEETING_SELECT).eq("id", meetingId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapGrowthMeetingRow(data as MeetingDbRow) : null
}

export async function fetchGrowthMeetingByReplyId(
  admin: SupabaseClient,
  replyId: string,
): Promise<GrowthMeeting | null> {
  const { data, error } = await meetingsTable(admin)
    .select(MEETING_SELECT)
    .eq("outbound_reply_id", replyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapGrowthMeetingRow(data as MeetingDbRow) : null
}

export async function fetchGrowthMeetingByRealtimeSessionId(
  admin: SupabaseClient,
  realtimeSessionId: string,
): Promise<GrowthMeeting | null> {
  const { data, error } = await meetingsTable(admin)
    .select(MEETING_SELECT)
    .eq("realtime_call_session_id", realtimeSessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapGrowthMeetingRow(data as MeetingDbRow) : null
}

export async function insertGrowthMeetingRow(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<GrowthMeeting> {
  const { data, error } = await meetingsTable(admin).insert(row).select(MEETING_SELECT).single()
  if (error) throw new Error(error.message)
  return mapGrowthMeetingRow(data as MeetingDbRow)
}

export async function updateGrowthMeetingRow(
  admin: SupabaseClient,
  meetingId: string,
  patch: Record<string, unknown>,
): Promise<GrowthMeeting> {
  const { data, error } = await meetingsTable(admin)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", meetingId)
    .select(MEETING_SELECT)
    .single()
  if (error) throw new Error(error.message)
  const meeting = mapGrowthMeetingRow(data as MeetingDbRow)
  if (patch.status && meeting.leadId) {
    invalidateCanonicalDecisionCacheForLead(meeting.leadId, `meeting_${String(patch.status)}`)
  }
  return meeting
}

export async function listGrowthMeetingsForLead(
  admin: SupabaseClient,
  leadId: string,
  limit = 30,
): Promise<GrowthMeeting[]> {
  const { data, error } = await meetingsTable(admin)
    .select(MEETING_SELECT)
    .eq("lead_id", leadId)
    .order("start_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapGrowthMeetingRow(row as MeetingDbRow))
}

export async function listGrowthMeetingInbox(
  admin: SupabaseClient,
  input: {
    view: GrowthMeetingInboxView
    ownerUserId?: string | null
    status?: GrowthMeetingStatus | null
    provider?: GrowthMeetingProvider | null
    limit?: number
  },
): Promise<GrowthMeeting[]> {
  const now = new Date().toISOString()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  let query = meetingsTable(admin).select(MEETING_SELECT)

  if (input.ownerUserId) query = query.eq("owner_user_id", input.ownerUserId)
  if (input.status) query = query.eq("status", input.status)
  if (input.provider) query = query.eq("provider", input.provider)

  switch (input.view) {
    case "upcoming":
      query = query.eq("status", "scheduled").gte("start_at", now)
      break
    case "meeting_requests":
      query = query.eq("status", "proposed")
      break
    case "outcomes_missing":
      query = query.eq("status", "completed").is("outcome", null)
      break
    case "no_shows":
      query = query.eq("status", "no_show")
      break
    case "followups_due":
      query = query.eq("status", "completed").lte("follow_up_due_at", now).not("follow_up_due_at", "is", null)
      break
    case "completed":
      query = query.eq("status", "completed")
      break
  }

  const { data, error } = await query
    .order("start_at", { ascending: true, nullsFirst: false })
    .limit(input.limit ?? 50)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapGrowthMeetingRow(row as MeetingDbRow))
}

export async function listGrowthMeetingsForDashboardScan(
  admin: SupabaseClient,
  input?: { ownerUserId?: string | null },
): Promise<GrowthMeeting[]> {
  let query = meetingsTable(admin).select(MEETING_SELECT)
  if (input?.ownerUserId) query = query.eq("owner_user_id", input.ownerUserId)
  const { data, error } = await query.order("updated_at", { ascending: false }).limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapGrowthMeetingRow(row as MeetingDbRow))
}

export async function attachCompanyNamesToMeetings(
  admin: SupabaseClient,
  meetings: GrowthMeeting[],
): Promise<GrowthMeeting[]> {
  const leadIds = [...new Set(meetings.map((m) => m.leadId))]
  if (leadIds.length === 0) return meetings
  const { data, error } = await admin.schema("growth").from("leads").select("id, company_name").in("id", leadIds)
  if (error) throw new Error(error.message)
  const nameMap = new Map((data ?? []).map((row) => [row.id as string, row.company_name as string]))
  return meetings.map((meeting) => ({ ...meeting, companyName: nameMap.get(meeting.leadId) ?? null }))
}

export async function fetchGrowthMeetingByCalendarEventId(
  admin: SupabaseClient,
  calendarEventId: string,
): Promise<GrowthMeeting | null> {
  const { data, error } = await meetingsTable(admin)
    .select(MEETING_SELECT)
    .eq("calendar_event_id", calendarEventId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapGrowthMeetingRow(data as MeetingDbRow) : null
}

export async function listGrowthMeetingsForOwnerInTimeRange(
  admin: SupabaseClient,
  ownerUserId: string,
  timeMin: string,
  timeMax: string,
): Promise<GrowthMeeting[]> {
  const { data, error } = await meetingsTable(admin)
    .select(MEETING_SELECT)
    .eq("owner_user_id", ownerUserId)
    .gte("start_at", timeMin)
    .lte("start_at", timeMax)
    .order("start_at", { ascending: true })
    .limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapGrowthMeetingRow(row as MeetingDbRow))
}

export async function listGrowthMeetingsWithCalendarConflict(
  admin: SupabaseClient,
  ownerUserId: string,
  limit = 20,
): Promise<GrowthMeeting[]> {
  const { data, error } = await meetingsTable(admin)
    .select(MEETING_SELECT)
    .eq("owner_user_id", ownerUserId)
    .eq("calendar_sync_status", "conflict")
    .order("calendar_last_sync_at", { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapGrowthMeetingRow(row as MeetingDbRow))
}
