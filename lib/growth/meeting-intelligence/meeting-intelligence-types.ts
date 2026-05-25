/** Client-safe Growth Engine meeting intelligence types (slice 6.23A). */

import type { GrowthCalendarSyncStatus } from "@/lib/growth/calendar/google-calendar-types"

export const GROWTH_MEETING_INTELLIGENCE_QA_MARKER = "meeting-intelligence-v1" as const

export const GROWTH_MEETING_STATUSES = [
  "proposed",
  "scheduled",
  "completed",
  "no_show",
  "canceled",
] as const
export type GrowthMeetingStatus = (typeof GROWTH_MEETING_STATUSES)[number]

export const GROWTH_MEETING_SOURCES = [
  "manual",
  "reply_intent",
  "calendar_sync",
  "live_coaching",
] as const
export type GrowthMeetingSource = (typeof GROWTH_MEETING_SOURCES)[number]

export const GROWTH_MEETING_PROVIDERS = [
  "google_meet",
  "zoom",
  "teams",
  "phone",
  "other",
] as const
export type GrowthMeetingProvider = (typeof GROWTH_MEETING_PROVIDERS)[number]

export const GROWTH_MEETING_INBOX_VIEWS = [
  "upcoming",
  "meeting_requests",
  "outcomes_missing",
  "no_shows",
  "followups_due",
  "completed",
] as const
export type GrowthMeetingInboxView = (typeof GROWTH_MEETING_INBOX_VIEWS)[number]

export const GROWTH_MEETING_STATUS_LABELS: Record<GrowthMeetingStatus, string> = {
  proposed: "Proposed",
  scheduled: "Scheduled",
  completed: "Completed",
  no_show: "No-show",
  canceled: "Canceled",
}

export const GROWTH_MEETING_SOURCE_LABELS: Record<GrowthMeetingSource, string> = {
  manual: "Manual",
  reply_intent: "Reply intent",
  calendar_sync: "Calendar sync",
  live_coaching: "Live coaching",
}

export const GROWTH_MEETING_PROVIDER_LABELS: Record<GrowthMeetingProvider, string> = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  teams: "Microsoft Teams",
  phone: "Phone",
  other: "Other",
}

export type GrowthMeeting = {
  id: string
  leadId: string
  ownerUserId: string | null
  opportunityId: string | null
  outboundReplyId: string | null
  realtimeCallSessionId: string | null
  title: string
  status: GrowthMeetingStatus
  startAt: string | null
  endAt: string | null
  source: GrowthMeetingSource
  provider: GrowthMeetingProvider | null
  calendarEventId: string | null
  calendarSyncStatus: GrowthCalendarSyncStatus | null
  calendarSyncError: string | null
  calendarSyncedAt: string | null
  calendarLastSyncAt: string | null
  meetingUrl: string | null
  notes: string | null
  attendeeEmails: string[]
  timezone: string
  outcome: string | null
  nextAction: string | null
  followUpDueAt: string | null
  noShowReason: string | null
  scheduledAt: string | null
  completedAt: string | null
  canceledAt: string | null
  noShowAt: string | null
  outcomeRecordedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  bookingPageId?: string | null
  companyName?: string | null
}

export type GrowthMeetingIntelligenceDashboard = {
  qaMarker: typeof GROWTH_MEETING_INTELLIGENCE_QA_MARKER
  calendarSyncReady: boolean
  calendarSetupMessage: string | null
  calendarAccountEmail: string | null
  calendarSyncHealth: string | null
  calendarLastSyncAt: string | null
  upcomingCount: number
  meetingRequestCount: number
  outcomesMissingCount: number
  noShowCount: number
  followUpsDueCount: number
  startingSoonCount: number
  completedTodayCount: number
}

export type GrowthMeetingCommandSummary = {
  qaMarker: typeof GROWTH_MEETING_INTELLIGENCE_QA_MARKER
  meetingsTodayCount: number
  noShowCount: number
  outcomesMissingCount: number
  followUpsDueCount: number
}

export type CreateGrowthMeetingInput = {
  leadId: string
  title: string
  status?: GrowthMeetingStatus
  startAt?: string | null
  endAt?: string | null
  source?: GrowthMeetingSource
  provider?: GrowthMeetingProvider | null
  calendarEventId?: string | null
  meetingUrl?: string | null
  notes?: string | null
  attendeeEmails?: string[]
  timezone?: string | null
  ownerUserId?: string | null
  opportunityId?: string | null
  outboundReplyId?: string | null
  realtimeCallSessionId?: string | null
  outcome?: string | null
  nextAction?: string | null
  followUpDueAt?: string | null
}

export type UpdateGrowthMeetingInput = {
  title?: string
  status?: GrowthMeetingStatus
  startAt?: string | null
  endAt?: string | null
  provider?: GrowthMeetingProvider | null
  calendarEventId?: string | null
  meetingUrl?: string | null
  notes?: string | null
  attendeeEmails?: string[]
  timezone?: string | null
  ownerUserId?: string | null
  opportunityId?: string | null
  outcome?: string | null
  nextAction?: string | null
  followUpDueAt?: string | null
  noShowReason?: string | null
  realtimeCallSessionId?: string | null
}
