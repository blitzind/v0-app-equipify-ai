/** Client-safe Google Calendar integration types (slice 6.27A). */

export const GROWTH_GOOGLE_CALENDAR_QA_MARKER = "google-calendar-v1" as const

export const GROWTH_CALENDAR_SYNC_STATUSES = ["pending", "synced", "failed", "conflict"] as const
export type GrowthCalendarSyncStatus = (typeof GROWTH_CALENDAR_SYNC_STATUSES)[number]

export const GROWTH_CALENDAR_SYNC_STATUS_LABELS: Record<GrowthCalendarSyncStatus, string> = {
  pending: "Pending sync",
  synced: "Synced",
  failed: "Sync failed",
  conflict: "Conflict",
}

export const GROWTH_CALENDAR_ACCOUNT_TYPES = ["workspace", "personal", "unknown"] as const
export type GrowthCalendarAccountType = (typeof GROWTH_CALENDAR_ACCOUNT_TYPES)[number]

export const GROWTH_CALENDAR_CONNECTION_STATUSES = ["connected", "disconnected", "error"] as const
export type GrowthCalendarConnectionStatus = (typeof GROWTH_CALENDAR_CONNECTION_STATUSES)[number]

export const GROWTH_CALENDAR_SYNC_HEALTH = ["healthy", "degraded", "failed"] as const
export type GrowthCalendarSyncHealth = (typeof GROWTH_CALENDAR_SYNC_HEALTH)[number]

export type GrowthCalendarConnectionSummary = {
  qaMarker: typeof GROWTH_GOOGLE_CALENDAR_QA_MARKER
  connected: boolean
  configured: boolean
  accountEmail: string | null
  accountType: GrowthCalendarAccountType | null
  status: GrowthCalendarConnectionStatus | null
  syncHealth: GrowthCalendarSyncHealth | null
  lastSyncAt: string | null
  lastSyncError: string | null
  setupMessage: string | null
}

export const GROWTH_CALENDAR_NOT_CONFIGURED_MESSAGE =
  "Google Calendar OAuth is not configured. Set GROWTH_GOOGLE_CALENDAR_CLIENT_ID and related env vars."

export const GROWTH_CALENDAR_NOT_CONNECTED_MESSAGE =
  "Connect Google Calendar in Growth Settings to sync meetings after human confirmation."
