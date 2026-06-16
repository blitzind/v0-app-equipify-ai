import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthEngagementAlerts } from "@/lib/growth/engagement/growth-engagement-alert-service"
import {
  getGrowthEngagementDashboardHighIntent,
  getGrowthEngagementDashboardOverview,
} from "@/lib/growth/engagement/growth-engagement-dashboard-service"
import { probeGrowthEngagementDashboardSourceAvailability } from "@/lib/growth/engagement/growth-engagement-dashboard-repository"
import { resolveEngagementDashboardDateRange } from "@/lib/growth/engagement/growth-engagement-dashboard-utils"
import {
  getGrowthEngagementReport,
} from "@/lib/growth/engagement/growth-engagement-report-service"
import { GROWTH_ENGAGEMENT_REPORT_CATALOG } from "@/lib/growth/engagement/growth-engagement-report-utils"
import { getGrowthEngagementTimeline } from "@/lib/growth/engagement/growth-engagement-timeline-service"
import { probeGrowthEngagementTimelineSourceAvailability } from "@/lib/growth/engagement/growth-engagement-timeline-repository"
import { listGrowthEngagementWatchlists } from "@/lib/growth/engagement/growth-engagement-watchlist-service"
import {
  GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER,
  GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS,
  type GrowthEngagementCommandCenterFilters,
  type GrowthEngagementCommandCenterHighIntentWorkspaceResponse,
  type GrowthEngagementCommandCenterOverviewResponse,
  type GrowthEngagementCommandCenterOverviewSection,
  type GrowthEngagementCommandCenterResponse,
  type GrowthEngagementCommandCenterTimelineResponse,
  type GrowthEngagementCommandCenterWorkspace,
} from "@/lib/growth/engagement/growth-engagement-command-center-types"
import {
  buildCommandCenterFeed,
  buildCommandCenterReportSummaries,
  buildCommandCenterSidebar,
  buildEngagementCommandCenterWorkspaceId,
  buildHighIntentWorkspaceCards,
  mergeCommandCenterSourceAvailability,
  parseEngagementCommandCenterFilters,
  toAlertFilters,
  toDashboardFilters,
  toReportFilters,
  toTimelineFilters,
} from "@/lib/growth/engagement/growth-engagement-command-center-utils"

const SUMMARY_REPORT_TYPES = ["overview", "template_performance", "high_intent"] as const

async function loadWorkspaceParts(admin: SupabaseClient, filters: GrowthEngagementCommandCenterFilters) {
  const dashboardFilters = toDashboardFilters(filters)
  const alertFilters = toAlertFilters(filters)
  const timelineFilters = toTimelineFilters(filters)
  const reportFilters = toReportFilters(filters)

  const [dashboardProbe, timelineProbe, dashboard, timeline, alertsPayload, highIntentSignals, watchlists, ...reports] =
    await Promise.all([
      probeGrowthEngagementDashboardSourceAvailability(admin),
      probeGrowthEngagementTimelineSourceAvailability(admin),
      getGrowthEngagementDashboardOverview(admin, dashboardFilters),
      getGrowthEngagementTimeline(admin, timelineFilters),
      listGrowthEngagementAlerts(admin, alertFilters),
      getGrowthEngagementDashboardHighIntent(admin, dashboardFilters),
      Promise.resolve(listGrowthEngagementWatchlists()),
      ...SUMMARY_REPORT_TYPES.map((reportType) => getGrowthEngagementReport(admin, reportType, reportFilters)),
    ])

  const timelineAvailable = Object.values(timelineProbe).some((entry) => entry.source_available)
  const sourceAvailability = mergeCommandCenterSourceAvailability({
    dashboard: dashboardProbe,
    timelineAvailable,
    timelineMessage: timelineAvailable ? null : "Timeline sources unavailable.",
  })

  const reportSummaries = buildCommandCenterReportSummaries(reports.map((entry) => entry.report))
  const highIntentCards = buildHighIntentWorkspaceCards(alertsPayload.alerts)
  const sidebar = buildCommandCenterSidebar({ alerts: alertsPayload.alerts })
  sidebar.reportShortcuts = reportSummaries.map((summary) => ({
    reportType: summary.reportType,
    title: summary.title,
    rowCount: summary.rowCount,
  }))

  const overviewSection: GrowthEngagementCommandCenterOverviewSection = {
    overview: dashboard.overview,
    ctaPerformance: dashboard.ctaPerformance,
    bookingHandoffReadiness: dashboard.bookingHandoffReadiness,
    topTemplates: dashboard.topTemplates,
    topAssets: dashboard.topAssets,
  }

  const feed = buildCommandCenterFeed({
    timelineEvents: timeline.timeline.items,
    alerts: alertsPayload.alerts,
    reportSummaries,
    highIntentCards,
    filters,
  })

  return {
    sourceAvailability,
    overviewSection,
    timeline,
    alertsPayload,
    highIntentSignals,
    watchlists,
    reportSummaries,
    highIntentCards,
    sidebar,
    feed,
  }
}

export async function getGrowthEngagementCommandCenter(
  admin: SupabaseClient,
  filters: GrowthEngagementCommandCenterFilters,
): Promise<GrowthEngagementCommandCenterResponse> {
  const generatedAt = new Date().toISOString()
  const parts = await loadWorkspaceParts(admin, filters)
  const dateRange = resolveEngagementDashboardDateRange(filters)

  const workspace: GrowthEngagementCommandCenterWorkspace = {
    workspaceId: buildEngagementCommandCenterWorkspaceId(generatedAt),
    generatedAt,
    filters,
    dateRange,
    overview: parts.overviewSection,
    timeline: parts.timeline,
    reports: {
      catalog: GROWTH_ENGAGEMENT_REPORT_CATALOG,
      summaries: parts.reportSummaries,
    },
    alerts: {
      alerts: parts.alertsPayload.alerts,
      total: parts.alertsPayload.total,
      filters: parts.alertsPayload.filters,
    },
    watchlists: parts.watchlists,
    highIntent: {
      signals: parts.highIntentSignals,
      cards: parts.highIntentCards,
    },
    feed: parts.feed,
    sidebar: parts.sidebar,
    sourceAvailability: parts.sourceAvailability,
    safety: GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS,
  }

  return {
    qa_marker: GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER,
    workspace,
    ...GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS,
  }
}

export async function getGrowthEngagementCommandCenterOverview(
  admin: SupabaseClient,
  filters: GrowthEngagementCommandCenterFilters,
): Promise<GrowthEngagementCommandCenterOverviewResponse> {
  const parts = await loadWorkspaceParts(admin, filters)

  return {
    qa_marker: GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER,
    filters,
    dateRange: resolveEngagementDashboardDateRange(filters),
    overview: parts.overviewSection,
    sidebar: parts.sidebar,
    sourceAvailability: parts.sourceAvailability,
    safety: GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS,
  }
}

export async function getGrowthEngagementCommandCenterTimeline(
  admin: SupabaseClient,
  filters: GrowthEngagementCommandCenterFilters,
): Promise<GrowthEngagementCommandCenterTimelineResponse> {
  const parts = await loadWorkspaceParts(admin, filters)

  return {
    qa_marker: GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER,
    filters,
    timeline: parts.timeline,
    feed: parts.feed,
    sourceAvailability: parts.sourceAvailability,
    safety: GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS,
  }
}

export async function getGrowthEngagementCommandCenterHighIntent(
  admin: SupabaseClient,
  filters: GrowthEngagementCommandCenterFilters,
): Promise<GrowthEngagementCommandCenterHighIntentWorkspaceResponse> {
  const parts = await loadWorkspaceParts(admin, filters)

  return {
    qa_marker: GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER,
    filters,
    highIntent: {
      signals: parts.highIntentSignals,
      cards: parts.highIntentCards,
    },
    sourceAvailability: parts.sourceAvailability,
    safety: GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS,
  }
}

export { parseEngagementCommandCenterFilters, GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER, GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS }
