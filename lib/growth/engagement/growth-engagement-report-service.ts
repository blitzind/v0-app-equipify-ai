import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getGrowthEngagementDashboardHighIntent,
  getGrowthEngagementDashboardMedia,
  getGrowthEngagementDashboardOverview,
  getGrowthEngagementDashboardTemplates,
} from "@/lib/growth/engagement/growth-engagement-dashboard-service"
import { fetchEngagementTimelineEvents } from "@/lib/growth/engagement/growth-engagement-timeline-repository"
import {
  filterEngagementTimelineEvents,
  parseEngagementTimelineFilters,
  summarizeLeadDrilldown,
} from "@/lib/growth/engagement/growth-engagement-timeline-utils"
import {
  GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS,
  type GrowthEngagementReport,
  type GrowthEngagementReportColumn,
  type GrowthEngagementReportFilters,
  type GrowthEngagementReportSourceAvailability,
  type GrowthEngagementReportType,
  GROWTH_ENGAGEMENT_REPORT_QA_MARKER,
  type GrowthEngagementReportsListResponse,
  type GrowthEngagementReportResponse,
  type GrowthEngagementReportCsvResponse,
} from "@/lib/growth/engagement/growth-engagement-report-types"
import {
  GROWTH_ENGAGEMENT_REPORT_CATALOG,
  buildEngagementReportCsvExport,
  buildEngagementReportId,
  limitEngagementReportRows,
  parseEngagementReportFilters,
  renderEngagementReportCsvText,
  rowsFromColumns,
} from "@/lib/growth/engagement/growth-engagement-report-utils"

function catalogEntry(reportType: GrowthEngagementReportType) {
  return GROWTH_ENGAGEMENT_REPORT_CATALOG.find((entry) => entry.reportType === reportType)!
}

function mergeSourceAvailability(
  ...sources: GrowthEngagementReportSourceAvailability[]
): GrowthEngagementReportSourceAvailability {
  return Object.assign({}, ...sources)
}

async function buildLeadEngagementReport(
  admin: SupabaseClient,
  filters: GrowthEngagementReportFilters,
  generatedAt: string,
): Promise<GrowthEngagementReport> {
  const timelineFilters = parseEngagementTimelineFilters(filters.organizationId, new URLSearchParams())
  timelineFilters.dateRange = filters.dateRange
  timelineFilters.startDate = filters.startDate
  timelineFilters.endDate = filters.endDate
  timelineFilters.leadId = filters.leadId
  timelineFilters.templateId = filters.templateId
  timelineFilters.mediaAssetId = filters.mediaAssetId
  timelineFilters.limit = filters.limit

  const loaded = await fetchEngagementTimelineEvents(admin, timelineFilters)
  const scoped = filterEngagementTimelineEvents(loaded.events, timelineFilters)
  const byLead = new Map<string, ReturnType<typeof summarizeLeadDrilldown>>()

  for (const event of scoped) {
    if (!event.leadId) continue
    if (!byLead.has(event.leadId)) {
      byLead.set(event.leadId, summarizeLeadDrilldown(scoped, event.leadId))
    }
  }

  const columns: GrowthEngagementReportColumn[] = [
    { key: "lead_id", label: "Lead ID" },
    { key: "share_page_views", label: "Share Page Views" },
    { key: "cta_clicks", label: "CTA Clicks" },
    { key: "booking_starts", label: "Booking Starts" },
    { key: "booking_completions", label: "Booking Completions" },
    { key: "media_views", label: "Media Views" },
    { key: "media_completions", label: "Media Completions" },
    { key: "high_intent_signals", label: "High Intent Signals" },
  ]

  const values = limitEngagementReportRows(
    [...byLead.values()].sort((a, b) => b.sharePageViews - a.sharePageViews || b.ctaClicks - a.ctaClicks),
    filters.limit,
  ).map((summary) => ({
    lead_id: summary.leadId,
    share_page_views: summary.sharePageViews,
    cta_clicks: summary.ctaClicks,
    booking_starts: summary.bookingStarts,
    booking_completions: summary.bookingCompletions,
    media_views: summary.mediaViews,
    media_completions: summary.mediaCompletions,
    high_intent_signals: summary.highIntentSignals,
  }))

  const entry = catalogEntry("lead_engagement")
  const dashboard = await getGrowthEngagementDashboardOverview(admin, filters)

  return {
    reportId: buildEngagementReportId("lead_engagement", generatedAt),
    reportType: "lead_engagement",
    title: entry.title,
    description: entry.description,
    dateRange: dashboard.dateRange,
    filters,
    columns,
    rows: rowsFromColumns(columns, values),
    totals: {
      lead_count: values.length,
      share_page_views: values.reduce((sum, row) => sum + Number(row.share_page_views ?? 0), 0),
      cta_clicks: values.reduce((sum, row) => sum + Number(row.cta_clicks ?? 0), 0),
    },
    sourceAvailability: mergeSourceAvailability(dashboard.sourceAvailability),
    generatedAt,
    safety: GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS,
  }
}

async function buildReportByType(
  admin: SupabaseClient,
  reportType: GrowthEngagementReportType,
  filters: GrowthEngagementReportFilters,
  generatedAt: string,
): Promise<GrowthEngagementReport> {
  const entry = catalogEntry(reportType)

  if (reportType === "lead_engagement") {
    return buildLeadEngagementReport(admin, filters, generatedAt)
  }

  if (reportType === "overview") {
    const dashboard = await getGrowthEngagementDashboardOverview(admin, filters)
    const columns: GrowthEngagementReportColumn[] = [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Value" },
    ]
    const values = [
      { metric: "Share page views", value: dashboard.overview.totalSharePageViews },
      { metric: "Unique visitors", value: dashboard.overview.uniqueSharePageVisitors },
      { metric: "CTA clicks", value: dashboard.overview.ctaClicks },
      { metric: "Booking starts", value: dashboard.overview.bookingStarts },
      { metric: "Booking completions", value: dashboard.overview.bookingCompletions },
      { metric: "Media views", value: dashboard.overview.mediaViews },
      { metric: "Media play starts", value: dashboard.overview.mediaPlayStarts },
      { metric: "Media completions", value: dashboard.overview.mediaCompletions },
      { metric: "Media CTA clicks", value: dashboard.overview.mediaCtaClicks },
      { metric: "Average watch seconds", value: Math.round(dashboard.overview.averageWatchSeconds) },
      { metric: "Completion rate", value: `${Math.round(dashboard.overview.completionRate * 100)}%` },
      { metric: "Templates in use", value: dashboard.overview.templateUsageCount },
    ]

    return {
      reportId: buildEngagementReportId(reportType, generatedAt),
      reportType,
      title: entry.title,
      description: entry.description,
      dateRange: dashboard.dateRange,
      filters,
      columns,
      rows: rowsFromColumns(columns, values),
      totals: {
        total_cta_clicks: dashboard.ctaPerformance.totalCtaClicks,
      },
      sourceAvailability: dashboard.sourceAvailability,
      generatedAt,
      safety: GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS,
    }
  }

  if (reportType === "template_performance") {
    const templates = await getGrowthEngagementDashboardTemplates(admin, filters)
    const columns: GrowthEngagementReportColumn[] = [
      { key: "template_id", label: "Template ID" },
      { key: "template_name", label: "Template Name" },
      { key: "usage_count", label: "Pages" },
      { key: "share_page_views", label: "Views" },
      { key: "cta_clicks", label: "CTA Clicks" },
      { key: "booking_starts", label: "Booking Starts" },
      { key: "booking_completions", label: "Booking Completions" },
    ]
    const values = limitEngagementReportRows(templates.items, filters.limit).map((item) => ({
      template_id: item.templateId,
      template_name: item.templateName,
      usage_count: item.usageCount,
      share_page_views: item.sharePageViews,
      cta_clicks: item.ctaClicks,
      booking_starts: item.bookingStarts,
      booking_completions: item.bookingCompletions,
    }))

    return {
      reportId: buildEngagementReportId(reportType, generatedAt),
      reportType,
      title: entry.title,
      description: entry.description,
      dateRange: templates.dateRange,
      filters,
      columns,
      rows: rowsFromColumns(columns, values),
      totals: {
        template_count: values.length,
        share_page_views: values.reduce((sum, row) => sum + Number(row.share_page_views ?? 0), 0),
      },
      sourceAvailability: templates.sourceAvailability,
      generatedAt,
      safety: GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS,
    }
  }

  if (reportType === "media_performance") {
    const media = await getGrowthEngagementDashboardMedia(admin, filters)
    const columns: GrowthEngagementReportColumn[] = [
      { key: "asset_id", label: "Asset ID" },
      { key: "asset_label", label: "Asset Label" },
      { key: "views", label: "Views" },
      { key: "unique_views", label: "Unique Views" },
      { key: "play_starts", label: "Play Starts" },
      { key: "completions", label: "Completions" },
      { key: "cta_clicks", label: "CTA Clicks" },
      { key: "average_watch_seconds", label: "Avg Watch Seconds" },
      { key: "completion_rate", label: "Completion Rate" },
    ]
    const values = limitEngagementReportRows(media.items, filters.limit).map((item) => ({
      asset_id: item.assetId,
      asset_label: item.assetLabel,
      views: item.views,
      unique_views: item.uniqueViews,
      play_starts: item.playStarts,
      completions: item.completions,
      cta_clicks: item.ctaClicks,
      average_watch_seconds: Math.round(item.averageWatchSeconds),
      completion_rate: `${Math.round(item.completionRate * 100)}%`,
    }))

    return {
      reportId: buildEngagementReportId(reportType, generatedAt),
      reportType,
      title: entry.title,
      description: entry.description,
      dateRange: media.dateRange,
      filters,
      columns,
      rows: rowsFromColumns(columns, values),
      totals: {
        asset_count: values.length,
        views: media.totals.views,
        completions: media.totals.completions,
      },
      sourceAvailability: media.sourceAvailability,
      generatedAt,
      safety: GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS,
    }
  }

  if (reportType === "cta_performance") {
    const dashboard = await getGrowthEngagementDashboardOverview(admin, filters)
    const columns: GrowthEngagementReportColumn[] = [
      { key: "channel", label: "Channel" },
      { key: "cta_clicks", label: "CTA Clicks" },
    ]
    const values = [
      { channel: "Share page", cta_clicks: dashboard.ctaPerformance.sharePageCtaClicks },
      { channel: "Media", cta_clicks: dashboard.ctaPerformance.mediaCtaClicks },
      ...limitEngagementReportRows(dashboard.ctaPerformance.topCtaKeys, filters.limit).map((item) => ({
        channel: item.key,
        cta_clicks: item.count,
      })),
    ]

    return {
      reportId: buildEngagementReportId(reportType, generatedAt),
      reportType,
      title: entry.title,
      description: entry.description,
      dateRange: dashboard.dateRange,
      filters,
      columns,
      rows: rowsFromColumns(columns, values),
      totals: {
        total_cta_clicks: dashboard.ctaPerformance.totalCtaClicks,
      },
      sourceAvailability: dashboard.sourceAvailability,
      generatedAt,
      safety: GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS,
    }
  }

  if (reportType === "booking_readiness") {
    const dashboard = await getGrowthEngagementDashboardOverview(admin, filters)
    const readiness = dashboard.bookingHandoffReadiness
    const columns: GrowthEngagementReportColumn[] = [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Value" },
    ]
    const values = [
      { metric: "Templates with handoff enabled", value: readiness.templatesWithHandoffEnabled },
      { metric: "Share page booking starts", value: readiness.sharePageBookingStarts },
      { metric: "Share page booking completions", value: readiness.sharePageBookingCompletions },
      { metric: "Foundation handoff records", value: readiness.foundationHandoffRecords },
      { metric: "Ready tier count", value: readiness.readyTierCount },
      { metric: "High-intent tier count", value: readiness.highIntentTierCount },
    ]

    return {
      reportId: buildEngagementReportId(reportType, generatedAt),
      reportType,
      title: entry.title,
      description: entry.description,
      dateRange: dashboard.dateRange,
      filters,
      columns,
      rows: rowsFromColumns(columns, values),
      totals: {
        booking_completions: readiness.sharePageBookingCompletions,
      },
      sourceAvailability: {
        share_pages: dashboard.sourceAvailability.share_pages,
        booking_handoff_foundation: dashboard.sourceAvailability.booking_handoff_foundation,
      },
      generatedAt,
      safety: GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS,
    }
  }

  const highIntent = await getGrowthEngagementDashboardHighIntent(admin, filters)
  const columns: GrowthEngagementReportColumn[] = [
    { key: "signal_id", label: "Signal ID" },
    { key: "company_name", label: "Company" },
    { key: "signal_type", label: "Signal Type" },
    { key: "lead_id", label: "Lead ID" },
    { key: "share_page_id", label: "Share Page ID" },
    { key: "score", label: "Score" },
    { key: "occurred_at", label: "Occurred At" },
    { key: "source", label: "Source" },
  ]
  const values = limitEngagementReportRows(highIntent.items, filters.limit).map((item) => ({
    signal_id: item.id,
    company_name: item.companyName,
    signal_type: item.signalType,
    lead_id: item.leadId,
    share_page_id: item.sharePageId,
    score: item.score,
    occurred_at: item.occurredAt,
    source: item.source,
  }))

  return {
    reportId: buildEngagementReportId("high_intent", generatedAt),
    reportType: "high_intent",
    title: entry.title,
    description: entry.description,
    dateRange: highIntent.dateRange,
    filters,
    columns,
    rows: rowsFromColumns(columns, values),
    totals: {
      signal_count: values.length,
    },
    sourceAvailability: highIntent.sourceAvailability,
    generatedAt,
    safety: GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS,
  }
}

export function listGrowthEngagementReports(): GrowthEngagementReportsListResponse {
  return {
    qa_marker: GROWTH_ENGAGEMENT_REPORT_QA_MARKER,
    reports: GROWTH_ENGAGEMENT_REPORT_CATALOG,
    safety: GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS,
  }
}

export async function getGrowthEngagementReport(
  admin: SupabaseClient,
  reportType: GrowthEngagementReportType,
  filters: GrowthEngagementReportFilters,
): Promise<GrowthEngagementReportResponse> {
  const generatedAt = new Date().toISOString()
  const report = await buildReportByType(admin, reportType, filters, generatedAt)
  return {
    qa_marker: GROWTH_ENGAGEMENT_REPORT_QA_MARKER,
    report,
    safety: GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS,
  }
}

export async function getGrowthEngagementReportCsv(
  admin: SupabaseClient,
  reportType: GrowthEngagementReportType,
  filters: GrowthEngagementReportFilters,
): Promise<GrowthEngagementReportCsvResponse> {
  const { report } = await getGrowthEngagementReport(admin, reportType, filters)
  const csv = buildEngagementReportCsvExport(report)
  return {
    qa_marker: GROWTH_ENGAGEMENT_REPORT_QA_MARKER,
    csv,
    csvText: renderEngagementReportCsvText(csv),
    safety: GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS,
  }
}

export { parseEngagementReportFilters, parseEngagementReportType } from "@/lib/growth/engagement/growth-engagement-report-utils"
export { GROWTH_ENGAGEMENT_REPORT_QA_MARKER, GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS }
