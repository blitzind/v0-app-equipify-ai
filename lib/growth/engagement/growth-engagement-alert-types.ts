/** Growth Engine S4-D — engagement alert read-model types (in-memory only). */

import type {
  GrowthEngagementDashboardDateRangePreset,
  GrowthEngagementDashboardResolvedDateRange,
  GrowthEngagementDashboardSourceAvailability,
} from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import type { GrowthEngagementWatchlistSafetyFlags } from "@/lib/growth/engagement/growth-engagement-watchlist-types"

export const GROWTH_ENGAGEMENT_ALERT_QA_MARKER = "growth-engagement-alert-s4d-v1" as const

export const GROWTH_ENGAGEMENT_ALERT_TYPES = [
  "high_intent_detected",
  "meeting_ready",
  "video_completed",
  "video_cta_clicked",
  "booking_started",
  "booking_completed",
  "repeat_viewer",
  "high_engagement_score",
  "multi_session_activity",
  "template_performance_spike",
] as const

export type GrowthEngagementAlertType = (typeof GROWTH_ENGAGEMENT_ALERT_TYPES)[number]

export const GROWTH_ENGAGEMENT_ALERT_SEVERITIES = ["low", "medium", "high", "critical"] as const

export type GrowthEngagementAlertSeverity = (typeof GROWTH_ENGAGEMENT_ALERT_SEVERITIES)[number]

export type GrowthEngagementAlertEntityType = "lead" | "template" | "media" | "share_page"

export type GrowthEngagementAlertSource =
  | "dashboard_overview"
  | "timeline_event"
  | "high_intent_signal"
  | "template_performance"
  | "media_rollup"
  | "booking_handoff_readiness"

export type GrowthEngagementAlert = {
  alertId: string
  watchlistId: string | null
  alertType: GrowthEngagementAlertType
  title: string
  description: string
  severity: GrowthEngagementAlertSeverity
  entityType: GrowthEngagementAlertEntityType
  entityId: string
  occurredAt: string
  metadata: Record<string, unknown>
  source: GrowthEngagementAlertSource
  acknowledged: false
}

export type GrowthEngagementAlertFilters = {
  organizationId: string
  dateRange: GrowthEngagementDashboardDateRangePreset
  startDate?: string | null
  endDate?: string | null
  severity?: GrowthEngagementAlertSeverity | null
  alertType?: GrowthEngagementAlertType | null
  leadId?: string | null
  templateId?: string | null
  mediaAssetId?: string | null
  sharePageId?: string | null
  watchlistId?: string | null
  limit?: number
}

export type GrowthEngagementAlertsListResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_ALERT_QA_MARKER
  filters: GrowthEngagementAlertFilters
  dateRange: GrowthEngagementDashboardResolvedDateRange
  alerts: GrowthEngagementAlert[]
  total: number
  safety: GrowthEngagementWatchlistSafetyFlags
  sourceAvailability: Partial<GrowthEngagementDashboardSourceAvailability>
}

export type GrowthEngagementAlertDetailResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_ALERT_QA_MARKER
  alert: GrowthEngagementAlert
  safety: GrowthEngagementWatchlistSafetyFlags
  sourceAvailability: Partial<GrowthEngagementDashboardSourceAvailability>
}
