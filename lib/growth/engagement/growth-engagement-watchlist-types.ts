/** Growth Engine S4-D — engagement watchlist read-model types (in-memory only). */

import type {
  GrowthEngagementDashboardDateRangePreset,
  GrowthEngagementDashboardSourceAvailability,
} from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import type { GrowthEngagementTimelineEventType } from "@/lib/growth/engagement/growth-engagement-timeline-types"
import type { GrowthEngagementAlertType } from "@/lib/growth/engagement/growth-engagement-alert-types"

export const GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER = "growth-engagement-watchlist-s4d-v1" as const

export type GrowthEngagementWatchlistSafetyFlags = {
  read_only: true
  no_db_mutations: true
  no_notifications: true
  no_sequence_execution: true
  no_provider_execution: true
  no_background_jobs: true
}

export const GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS: GrowthEngagementWatchlistSafetyFlags = {
  read_only: true,
  no_db_mutations: true,
  no_notifications: true,
  no_sequence_execution: true,
  no_provider_execution: true,
  no_background_jobs: true,
}

export type GrowthEngagementWatchlistFilters = {
  dateRange?: GrowthEngagementDashboardDateRangePreset | null
  leadId?: string | null
  templateId?: string | null
  mediaAssetId?: string | null
  sharePageId?: string | null
  eventTypes?: GrowthEngagementTimelineEventType[] | null
  minimumEngagementScore?: number | null
  minimumReadinessTier?: string | null
  minimumWatchSeconds?: number | null
}

export type GrowthEngagementWatchlistRules = {
  alertTypes: GrowthEngagementAlertType[]
  minimumEngagementScore?: number | null
  minimumReadinessTier?: string | null
  minimumWatchSeconds?: number | null
}

export type GrowthEngagementWatchlist = {
  watchlistId: string
  name: string
  description: string
  enabled: boolean
  filters: GrowthEngagementWatchlistFilters
  rules: GrowthEngagementWatchlistRules
  createdAt: string
  updatedAt: string
  safety: GrowthEngagementWatchlistSafetyFlags
}

export type GrowthEngagementWatchlistsListResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER
  watchlists: GrowthEngagementWatchlist[]
  safety: GrowthEngagementWatchlistSafetyFlags
}

export type GrowthEngagementWatchlistDetailResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER
  watchlist: GrowthEngagementWatchlist
  alertCount: number
  safety: GrowthEngagementWatchlistSafetyFlags
  sourceAvailability: Partial<GrowthEngagementDashboardSourceAvailability>
}
