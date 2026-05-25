/** Client-safe calendar integration readiness for meeting intelligence. */

export const GROWTH_CALENDAR_SYNC_SETUP_MESSAGE =
  "Google Calendar sync is not connected yet. Track meetings manually — calendar-ready fields are preserved for future OAuth setup."

export type GrowthCalendarSyncReadiness = {
  ready: boolean
  provider: "google_calendar" | null
  setupMessage: string | null
}

export function resolveGrowthCalendarSyncReadiness(): GrowthCalendarSyncReadiness {
  return {
    ready: false,
    provider: null,
    setupMessage: GROWTH_CALENDAR_SYNC_SETUP_MESSAGE,
  }
}
