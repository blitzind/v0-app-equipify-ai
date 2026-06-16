import { z } from "zod"
import {
  GROWTH_ENGAGEMENT_ALERT_SEVERITIES,
  GROWTH_ENGAGEMENT_ALERT_TYPES,
  type GrowthEngagementAlert,
  type GrowthEngagementAlertSeverity,
  type GrowthEngagementAlertType,
} from "@/lib/growth/engagement/growth-engagement-alert-types"
import {
  GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE,
  type GrowthEngagementDashboardDateRangePreset,
  type GrowthEngagementDashboardSourceAvailability,
} from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import { parseEngagementDashboardFilters } from "@/lib/growth/engagement/growth-engagement-dashboard-utils"
import { GROWTH_ENGAGEMENT_TIMELINE_EVENT_TYPES } from "@/lib/growth/engagement/growth-engagement-timeline-types"
import type { GrowthEngagementTimelineEvent } from "@/lib/growth/engagement/growth-engagement-timeline-types"
import type { GrowthEngagementReport } from "@/lib/growth/engagement/growth-engagement-report-types"
import { GROWTH_ENGAGEMENT_REPORT_CATALOG } from "@/lib/growth/engagement/growth-engagement-report-utils"
import {
  alertMatchesWatchlist,
  GROWTH_ENGAGEMENT_PREDEFINED_WATCHLISTS,
  parseEngagementAlertSeverity,
  parseEngagementAlertType,
} from "@/lib/growth/engagement/growth-engagement-watchlist-utils"
import type {
  GrowthEngagementCommandCenterFeedItem,
  GrowthEngagementCommandCenterFeedSection,
  GrowthEngagementCommandCenterFilters,
  GrowthEngagementCommandCenterHighIntentCard,
  GrowthEngagementCommandCenterReportSummary,
  GrowthEngagementCommandCenterSidebar,
  GrowthEngagementCommandCenterSourceAvailability,
} from "@/lib/growth/engagement/growth-engagement-command-center-types"

export const GROWTH_ENGAGEMENT_COMMAND_CENTER_DEFAULT_LIMIT = 100 as const
export const GROWTH_ENGAGEMENT_COMMAND_CENTER_MAX_LIMIT = 500 as const

export const GROWTH_ENGAGEMENT_COMMAND_CENTER_HIGH_INTENT_ALERT_TYPES: GrowthEngagementAlertType[] = [
  "meeting_ready",
  "booking_completed",
  "high_intent_detected",
  "video_cta_clicked",
  "repeat_viewer",
  "multi_session_activity",
  "high_engagement_score",
  "template_performance_spike",
]

const DATE_RANGE_SCHEMA = z.enum(["last_7_days", "last_30_days", "last_90_days", "custom"])
const EVENT_TYPE_SCHEMA = z.enum(GROWTH_ENGAGEMENT_TIMELINE_EVENT_TYPES)

export function clampEngagementCommandCenterLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return GROWTH_ENGAGEMENT_COMMAND_CENTER_DEFAULT_LIMIT
  return Math.min(
    Math.max(Math.floor(value ?? GROWTH_ENGAGEMENT_COMMAND_CENTER_DEFAULT_LIMIT), 1),
    GROWTH_ENGAGEMENT_COMMAND_CENTER_MAX_LIMIT,
  )
}

export function parseEngagementCommandCenterFilters(
  organizationId: string,
  searchParams: URLSearchParams,
): GrowthEngagementCommandCenterFilters {
  const dashboardFilters = parseEngagementDashboardFilters(organizationId, searchParams)
  const dateRangeRaw = searchParams.get("dateRange") ?? searchParams.get("date_range")
  const parsedDateRange = dateRangeRaw ? DATE_RANGE_SCHEMA.safeParse(dateRangeRaw) : null
  const dateRange: GrowthEngagementDashboardDateRangePreset = parsedDateRange?.success
    ? parsedDateRange.data
    : dashboardFilters.dateRange ?? GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE

  const eventTypeRaw = searchParams.get("eventType") ?? searchParams.get("event_type")
  const parsedEventType = eventTypeRaw ? EVENT_TYPE_SCHEMA.safeParse(eventTypeRaw) : null
  const limitRaw = searchParams.get("limit")

  return {
    organizationId,
    dateRange,
    startDate: dashboardFilters.startDate,
    endDate: dashboardFilters.endDate,
    leadId: searchParams.get("leadId") ?? searchParams.get("lead_id") ?? dashboardFilters.leadId,
    templateId: searchParams.get("templateId") ?? searchParams.get("template_id") ?? dashboardFilters.templateId,
    mediaAssetId:
      searchParams.get("mediaAssetId") ??
      searchParams.get("media_asset_id") ??
      searchParams.get("assetId") ??
      dashboardFilters.mediaAssetId,
    sharePageId: searchParams.get("sharePageId") ?? searchParams.get("share_page_id"),
    severity: parseEngagementAlertSeverity(searchParams.get("severity")),
    alertType: parseEngagementAlertType(searchParams.get("alertType") ?? searchParams.get("alert_type")),
    eventType: parsedEventType?.success ? parsedEventType.data : null,
    watchlistId: searchParams.get("watchlistId") ?? searchParams.get("watchlist_id"),
    search: searchParams.get("search"),
    limit: limitRaw ? clampEngagementCommandCenterLimit(Number(limitRaw)) : GROWTH_ENGAGEMENT_COMMAND_CENTER_DEFAULT_LIMIT,
    cursor: searchParams.get("cursor"),
  }
}

export function buildEngagementCommandCenterWorkspaceId(generatedAt: string): string {
  return `command-center:${generatedAt}`
}

export function mergeCommandCenterSourceAvailability(input: {
  dashboard: GrowthEngagementDashboardSourceAvailability
  timelineAvailable: boolean
  timelineMessage?: string | null
}): GrowthEngagementCommandCenterSourceAvailability {
  const reportsAvailable =
    input.dashboard.share_pages.source_available ||
    input.dashboard.share_page_analytics.source_available ||
    input.dashboard.media_assets.source_available

  const alertsAvailable =
    input.timelineAvailable ||
    input.dashboard.high_intent_signals.source_available ||
    input.dashboard.share_page_analytics.source_available

  return {
    share_pages: input.dashboard.share_pages,
    share_page_analytics: input.dashboard.share_page_analytics,
    media_assets: input.dashboard.media_assets,
    media_asset_events: input.dashboard.media_asset_events,
    share_page_templates: input.dashboard.share_page_templates,
    booking_handoff_foundation: input.dashboard.booking_handoff_foundation,
    high_intent_signals: input.dashboard.high_intent_signals,
    watchlists: { source_available: true, message: "Predefined in-memory watchlists." },
    alerts: {
      source_available: alertsAvailable,
      message: alertsAvailable ? null : "Alert feed requires timeline or high-intent sources.",
    },
    reports: {
      source_available: reportsAvailable,
      message: reportsAvailable ? null : "Reports require dashboard analytics sources.",
    },
    timeline: {
      source_available: input.timelineAvailable,
      message: input.timelineMessage ?? null,
    },
  }
}

export function buildCommandCenterReportSummaries(reports: GrowthEngagementReport[]): GrowthEngagementCommandCenterReportSummary[] {
  return reports.map((report) => ({
    reportType: report.reportType,
    title: report.title,
    rowCount: report.rows.length,
    totals: report.totals,
  }))
}

export function buildHighIntentWorkspaceCards(alerts: GrowthEngagementAlert[]): GrowthEngagementCommandCenterHighIntentCard[] {
  return alerts
    .filter((alert) => GROWTH_ENGAGEMENT_COMMAND_CENTER_HIGH_INTENT_ALERT_TYPES.includes(alert.alertType))
    .map((alert) => ({
      cardId: alert.alertId,
      alertType: alert.alertType,
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      entityType: alert.entityType,
      entityId: alert.entityId,
      occurredAt: alert.occurredAt,
      metadata: alert.metadata,
    }))
}

export function buildCommandCenterSidebar(input: {
  alerts: GrowthEngagementAlert[]
}): GrowthEngagementCommandCenterSidebar {
  const alertsBySeverity = GROWTH_ENGAGEMENT_ALERT_SEVERITIES.reduce(
    (acc, severity) => {
      acc[severity] = input.alerts.filter((alert) => alert.severity === severity).length
      return acc
    },
    {} as Record<GrowthEngagementAlertSeverity, number>,
  )

  const watchlists = GROWTH_ENGAGEMENT_PREDEFINED_WATCHLISTS.map((watchlist) => ({
    watchlistId: watchlist.watchlistId,
    name: watchlist.name,
    alertCount: input.alerts.filter((alert) => alertMatchesWatchlist(alert, watchlist)).length,
  }))

  const reportShortcuts = GROWTH_ENGAGEMENT_REPORT_CATALOG.map((entry) => ({
    reportType: entry.reportType,
    title: entry.title,
    rowCount: 0,
  }))

  return {
    watchlists,
    alertsBySeverity,
    reportShortcuts,
  }
}

function feedMatchesSearch(item: Pick<GrowthEngagementCommandCenterFeedItem, "title" | "description">, search: string | null | undefined): boolean {
  if (!search?.trim()) return true
  const needle = search.trim().toLowerCase()
  return item.title.toLowerCase().includes(needle) || item.description.toLowerCase().includes(needle)
}

export function buildCommandCenterFeed(input: {
  timelineEvents: GrowthEngagementTimelineEvent[]
  alerts: GrowthEngagementAlert[]
  reportSummaries: GrowthEngagementCommandCenterReportSummary[]
  highIntentCards: GrowthEngagementCommandCenterHighIntentCard[]
  filters: GrowthEngagementCommandCenterFilters
}): GrowthEngagementCommandCenterFeedSection {
  const timelineItems: GrowthEngagementCommandCenterFeedItem[] = input.timelineEvents.map((event) => ({
    feedId: `timeline:${event.eventId}`,
    kind: "timeline",
    occurredAt: event.occurredAt,
    title: event.title,
    description: event.description,
    entityType: event.leadId ? "lead" : event.templateId ? "template" : event.mediaAssetId ? "media" : event.sharePageId ? "share_page" : null,
    entityId: event.leadId ?? event.templateId ?? event.mediaAssetId ?? event.sharePageId,
    metadata: {
      eventType: event.eventType,
      leadId: event.leadId,
      templateId: event.templateId,
      mediaAssetId: event.mediaAssetId,
      sharePageId: event.sharePageId,
    },
  }))

  const alertItems: GrowthEngagementCommandCenterFeedItem[] = input.alerts.map((alert) => ({
    feedId: `alert:${alert.alertId}`,
    kind: "alert",
    occurredAt: alert.occurredAt,
    title: alert.title,
    description: alert.description,
    severity: alert.severity,
    entityType: alert.entityType,
    entityId: alert.entityId,
    metadata: { alertType: alert.alertType, ...alert.metadata },
  }))

  const reportItems: GrowthEngagementCommandCenterFeedItem[] = input.reportSummaries.map((summary) => ({
    feedId: `report:${summary.reportType}`,
    kind: "report",
    occurredAt: new Date().toISOString(),
    title: summary.title,
    description: `${summary.rowCount} rows in report summary.`,
    metadata: { reportType: summary.reportType, totals: summary.totals },
  }))

  const highIntentItems: GrowthEngagementCommandCenterFeedItem[] = input.highIntentCards.map((card) => ({
    feedId: `high_intent:${card.cardId}`,
    kind: "high_intent",
    occurredAt: card.occurredAt,
    title: card.title,
    description: card.description,
    severity: card.severity,
    entityType: card.entityType,
    entityId: card.entityId,
    metadata: { alertType: card.alertType, ...card.metadata },
  }))

  const merged = [...timelineItems, ...alertItems, ...reportItems, ...highIntentItems]
    .filter((item) => feedMatchesSearch(item, input.filters.search))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

  const limit = clampEngagementCommandCenterLimit(input.filters.limit)
  const cursorIndex = input.filters.cursor ? merged.findIndex((item) => item.feedId === input.filters.cursor) + 1 : 0
  const start = Math.max(cursorIndex, 0)
  const items = merged.slice(start, start + limit)
  const nextItem = merged[start + limit]
  const nextCursor = nextItem ? nextItem.feedId : null

  return {
    items,
    nextCursor,
    total: merged.length,
    limit,
  }
}

export function toDashboardFilters(filters: GrowthEngagementCommandCenterFilters) {
  return {
    organizationId: filters.organizationId,
    dateRange: filters.dateRange,
    startDate: filters.startDate,
    endDate: filters.endDate,
    leadId: filters.leadId,
    templateId: filters.templateId,
    mediaAssetId: filters.mediaAssetId,
  }
}

export function toAlertFilters(filters: GrowthEngagementCommandCenterFilters) {
  return {
    organizationId: filters.organizationId,
    dateRange: filters.dateRange,
    startDate: filters.startDate,
    endDate: filters.endDate,
    leadId: filters.leadId,
    templateId: filters.templateId,
    mediaAssetId: filters.mediaAssetId,
    sharePageId: filters.sharePageId,
    severity: filters.severity,
    alertType: filters.alertType,
    watchlistId: filters.watchlistId,
    limit: filters.limit,
  }
}

export function toReportFilters(filters: GrowthEngagementCommandCenterFilters) {
  return {
    ...toDashboardFilters(filters),
    limit: filters.limit,
  }
}

export function toTimelineFilters(filters: GrowthEngagementCommandCenterFilters) {
  return {
    organizationId: filters.organizationId,
    dateRange: filters.dateRange,
    startDate: filters.startDate,
    endDate: filters.endDate,
    leadId: filters.leadId,
    templateId: filters.templateId,
    mediaAssetId: filters.mediaAssetId,
    sharePageId: filters.sharePageId,
    eventType: filters.eventType,
    limit: filters.limit,
    cursor: filters.cursor,
  }
}
