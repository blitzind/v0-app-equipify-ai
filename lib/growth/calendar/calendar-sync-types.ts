/** Client-safe calendar sync run types (slice 6.27B). */

export const GROWTH_CALENDAR_SYNC_QA_MARKER = "calendar-sync-v1" as const

export const GROWTH_CALENDAR_SYNC_RUN_STATUSES = ["running", "completed", "failed"] as const
export type GrowthCalendarSyncRunStatus = (typeof GROWTH_CALENDAR_SYNC_RUN_STATUSES)[number]

export const GROWTH_CALENDAR_SYNC_TRIGGER_TYPES = ["manual_force", "manual_pull"] as const
export type GrowthCalendarSyncTriggerType = (typeof GROWTH_CALENDAR_SYNC_TRIGGER_TYPES)[number]

export type GrowthCalendarSyncRunSummary = {
  id: string
  triggerType: GrowthCalendarSyncTriggerType
  status: GrowthCalendarSyncRunStatus
  startedAt: string
  completedAt: string | null
  eventsFetched: number
  eventsMatched: number
  eventsCreated: number
  eventsUpdated: number
  eventsSynced: number
  conflictsDetected: number
  syncError: string | null
}

export type GrowthCalendarSyncStatusPanel = {
  qaMarker: typeof GROWTH_CALENDAR_SYNC_QA_MARKER
  lastSyncAt: string | null
  lastSyncStatus: GrowthCalendarSyncRunStatus | null
  lastSyncError: string | null
  eventsSynced: number
  conflictsDetected: number
  latestRun: GrowthCalendarSyncRunSummary | null
}

export type GrowthCalendarConflictMeeting = {
  meetingId: string
  leadId: string
  companyName: string | null
  title: string
  startAt: string | null
  calendarEventId: string | null
  calendarSyncError: string | null
  calendarLastSyncAt: string | null
}
