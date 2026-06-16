/** Growth Engine S4-E — engagement command center workspace types (read-only composition). */

import type {
  GrowthEngagementAlert,
  GrowthEngagementAlertSeverity,
  GrowthEngagementAlertType,
  GrowthEngagementAlertsListResponse,
} from "@/lib/growth/engagement/growth-engagement-alert-types"
import type { GrowthEngagementWatchlistsListResponse } from "@/lib/growth/engagement/growth-engagement-watchlist-types"
import type {
  GrowthEngagementDashboardDateRangePreset,
  GrowthEngagementDashboardHighIntentResponse,
  GrowthEngagementDashboardOverviewResponse,
  GrowthEngagementDashboardResolvedDateRange,
} from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import type { GrowthEngagementReportCatalogEntry } from "@/lib/growth/engagement/growth-engagement-report-types"
import type { GrowthEngagementTimelineEventType, GrowthEngagementTimelineResponse } from "@/lib/growth/engagement/growth-engagement-timeline-types"

export const GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER = "growth-engagement-command-center-s4e-v1" as const

export type GrowthEngagementCommandCenterSafetyFlags = {
  read_only: true
  no_db_mutations: true
  no_notifications: true
  no_sequence_execution: true
  no_provider_execution: true
  no_background_jobs: true
}

export const GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS: GrowthEngagementCommandCenterSafetyFlags = {
  read_only: true,
  no_db_mutations: true,
  no_notifications: true,
  no_sequence_execution: true,
  no_provider_execution: true,
  no_background_jobs: true,
}

export type GrowthEngagementCommandCenterSourceKey =
  | "share_pages"
  | "share_page_analytics"
  | "media_assets"
  | "media_asset_events"
  | "share_page_templates"
  | "booking_handoff_foundation"
  | "high_intent_signals"
  | "watchlists"
  | "alerts"
  | "reports"
  | "timeline"

export type GrowthEngagementCommandCenterSourceAvailability = Record<
  GrowthEngagementCommandCenterSourceKey,
  {
    source_available: boolean
    message?: string | null
  }
>

export type GrowthEngagementCommandCenterFilters = {
  organizationId: string
  dateRange: GrowthEngagementDashboardDateRangePreset
  startDate?: string | null
  endDate?: string | null
  leadId?: string | null
  templateId?: string | null
  mediaAssetId?: string | null
  sharePageId?: string | null
  severity?: GrowthEngagementAlertSeverity | null
  alertType?: GrowthEngagementAlertType | null
  eventType?: GrowthEngagementTimelineEventType | null
  watchlistId?: string | null
  search?: string | null
  limit?: number
  cursor?: string | null
}

export type GrowthEngagementCommandCenterReportSummary = {
  reportType: string
  title: string
  rowCount: number
  totals: Record<string, string | number | null>
}

export type GrowthEngagementCommandCenterReportsSection = {
  catalog: GrowthEngagementReportCatalogEntry[]
  summaries: GrowthEngagementCommandCenterReportSummary[]
}

export type GrowthEngagementCommandCenterHighIntentCard = {
  cardId: string
  alertType: GrowthEngagementAlertType
  title: string
  description: string
  severity: GrowthEngagementAlertSeverity
  entityType: GrowthEngagementAlert["entityType"]
  entityId: string
  occurredAt: string
  metadata: Record<string, unknown>
}

export type GrowthEngagementCommandCenterHighIntentSection = {
  signals: GrowthEngagementDashboardHighIntentResponse
  cards: GrowthEngagementCommandCenterHighIntentCard[]
}

export type GrowthEngagementCommandCenterFeedItem = {
  feedId: string
  kind: "timeline" | "alert" | "report" | "high_intent"
  occurredAt: string
  title: string
  description: string
  severity?: GrowthEngagementAlertSeverity | null
  entityType?: GrowthEngagementAlert["entityType"] | null
  entityId?: string | null
  metadata?: Record<string, unknown>
}

export type GrowthEngagementCommandCenterFeedSection = {
  items: GrowthEngagementCommandCenterFeedItem[]
  nextCursor: string | null
  total: number
  limit: number
}

export type GrowthEngagementCommandCenterSidebar = {
  watchlists: Array<{ watchlistId: string; name: string; alertCount: number }>
  alertsBySeverity: Record<GrowthEngagementAlertSeverity, number>
  reportShortcuts: Array<{ reportType: string; title: string; rowCount: number }>
}

export type GrowthEngagementCommandCenterOverviewSection = Pick<
  GrowthEngagementDashboardOverviewResponse,
  "overview" | "ctaPerformance" | "bookingHandoffReadiness" | "topTemplates" | "topAssets"
>

export type GrowthEngagementCommandCenterWorkspace = {
  workspaceId: string
  generatedAt: string
  filters: GrowthEngagementCommandCenterFilters
  dateRange: GrowthEngagementDashboardResolvedDateRange
  overview: GrowthEngagementCommandCenterOverviewSection
  timeline: GrowthEngagementTimelineResponse
  reports: GrowthEngagementCommandCenterReportsSection
  alerts: Pick<GrowthEngagementAlertsListResponse, "alerts" | "total" | "filters">
  watchlists: GrowthEngagementWatchlistsListResponse
  highIntent: GrowthEngagementCommandCenterHighIntentSection
  feed: GrowthEngagementCommandCenterFeedSection
  sidebar: GrowthEngagementCommandCenterSidebar
  sourceAvailability: GrowthEngagementCommandCenterSourceAvailability
  safety: GrowthEngagementCommandCenterSafetyFlags
}

export type GrowthEngagementCommandCenterResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER
  workspace: GrowthEngagementCommandCenterWorkspace
} & GrowthEngagementCommandCenterSafetyFlags

export type GrowthEngagementCommandCenterOverviewResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER
  filters: GrowthEngagementCommandCenterFilters
  dateRange: GrowthEngagementDashboardResolvedDateRange
  overview: GrowthEngagementCommandCenterOverviewSection
  sidebar: GrowthEngagementCommandCenterSidebar
  sourceAvailability: GrowthEngagementCommandCenterSourceAvailability
  safety: GrowthEngagementCommandCenterSafetyFlags
}

export type GrowthEngagementCommandCenterTimelineResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER
  filters: GrowthEngagementCommandCenterFilters
  timeline: GrowthEngagementTimelineResponse
  feed: GrowthEngagementCommandCenterFeedSection
  sourceAvailability: GrowthEngagementCommandCenterSourceAvailability
  safety: GrowthEngagementCommandCenterSafetyFlags
}

export type GrowthEngagementCommandCenterHighIntentWorkspaceResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER
  filters: GrowthEngagementCommandCenterFilters
  highIntent: GrowthEngagementCommandCenterHighIntentSection
  sourceAvailability: GrowthEngagementCommandCenterSourceAvailability
  safety: GrowthEngagementCommandCenterSafetyFlags
}
