/** Client-safe calendar integration readiness for meeting intelligence. */

import type { GrowthCalendarSyncStatus } from "@/lib/growth/calendar/google-calendar-types"

export {
  GROWTH_CALENDAR_NOT_CONNECTED_MESSAGE,
  GROWTH_CALENDAR_SYNC_STATUS_LABELS,
  GROWTH_CALENDAR_SYNC_STATUSES,
  type GrowthCalendarSyncStatus,
} from "@/lib/growth/calendar/google-calendar-types"

export const GROWTH_CALENDAR_SYNC_SETUP_MESSAGE =
  "Connect Google Calendar in Growth Settings to sync meetings after human confirmation."

export type GrowthCalendarSyncReadiness = {
  ready: boolean
  provider: "google_calendar" | null
  setupMessage: string | null
}

/** Client-side fallback when connection status is unknown. */
export function resolveGrowthCalendarSyncReadiness(): GrowthCalendarSyncReadiness {
  return {
    ready: false,
    provider: null,
    setupMessage: GROWTH_CALENDAR_SYNC_SETUP_MESSAGE,
  }
}
