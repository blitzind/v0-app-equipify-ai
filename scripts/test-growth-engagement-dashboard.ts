/**
 * S4-A — Engagement dashboard foundation certification.
 *
 * Local: pnpm test:growth-engagement-dashboard
 * Production: pnpm test:growth-engagement-dashboard:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  aggregateOverviewFromSamples,
  computeMediaCompletionRate,
  resolveEngagementDashboardDateRange,
  rollupRowsFromSampleEvents,
} from "../lib/growth/engagement/growth-engagement-dashboard-utils"
import {
  clampEngagementTimelineLimit,
  decodeEngagementTimelineCursor,
  encodeEngagementTimelineCursor,
  filterEngagementTimelineEvents,
  mapMediaEventType,
  mapSharePageEventType,
  paginateEngagementTimelineEvents,
  summarizeLeadDrilldown,
} from "../lib/growth/engagement/growth-engagement-timeline-utils"
import {
  GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE,
  GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER,
  GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS,
} from "../lib/growth/engagement/growth-engagement-dashboard-types"
import {
  GROWTH_ENGAGEMENT_TIMELINE_EVENT_TYPES,
  GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER,
} from "../lib/growth/engagement/growth-engagement-timeline-types"
import {
  buildEngagementReportCsvExport,
  clampEngagementReportLimit,
  parseEngagementReportType,
  renderEngagementReportCsvText,
  rowsFromColumns,
} from "../lib/growth/engagement/growth-engagement-report-utils"
import {
  GROWTH_ENGAGEMENT_REPORT_QA_MARKER,
  GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS,
  GROWTH_ENGAGEMENT_REPORT_TYPES,
} from "../lib/growth/engagement/growth-engagement-report-types"
import {
  GROWTH_ENGAGEMENT_ALERT_TYPES,
  GROWTH_ENGAGEMENT_ALERT_QA_MARKER,
} from "../lib/growth/engagement/growth-engagement-alert-types"
import {
  GROWTH_ENGAGEMENT_PREDEFINED_WATCHLISTS,
  GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER,
  GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS,
  alertMatchesWatchlist,
  clampEngagementAlertLimit,
  parseEngagementAlertType,
  resolveEngagementAlertSeverity,
} from "../lib/growth/engagement/growth-engagement-watchlist-utils"
import {
  buildCommandCenterFeed,
  clampEngagementCommandCenterLimit,
  GROWTH_ENGAGEMENT_COMMAND_CENTER_HIGH_INTENT_ALERT_TYPES,
} from "../lib/growth/engagement/growth-engagement-command-center-utils"
import {
  GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER,
  GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS,
} from "../lib/growth/engagement/growth-engagement-command-center-types"

const MODULE_PATHS = [
  "lib/growth/engagement/growth-engagement-dashboard-types.ts",
  "lib/growth/engagement/growth-engagement-dashboard-repository.ts",
  "lib/growth/engagement/growth-engagement-dashboard-utils.ts",
  "lib/growth/engagement/growth-engagement-dashboard-service.ts",
  "lib/growth/engagement/growth-engagement-dashboard-diagnostics.ts",
  "lib/growth/engagement/growth-engagement-dashboard-production-diagnostics.ts",
  "app/api/platform/growth/engagement-dashboard/route.ts",
  "app/api/platform/growth/engagement-dashboard/templates/route.ts",
  "app/api/platform/growth/engagement-dashboard/media/route.ts",
  "app/api/platform/growth/engagement-dashboard/high-intent/route.ts",
  "app/(admin)/admin/growth/engagement/page.tsx",
  "components/growth/engagement/growth-engagement-dashboard.tsx",
  "components/growth/engagement/growth-engagement-summary-cards.tsx",
  "components/growth/engagement/growth-engagement-template-table.tsx",
  "components/growth/engagement/growth-engagement-media-table.tsx",
  "components/growth/engagement/growth-engagement-high-intent-panel.tsx",
] as const

const S4B_MODULE_PATHS = [
  "lib/growth/engagement/growth-engagement-timeline-types.ts",
  "lib/growth/engagement/growth-engagement-timeline-utils.ts",
  "lib/growth/engagement/growth-engagement-timeline-repository.ts",
  "lib/growth/engagement/growth-engagement-timeline-service.ts",
  "lib/growth/engagement/growth-engagement-timeline-diagnostics.ts",
  "lib/growth/engagement/growth-engagement-timeline-production-diagnostics.ts",
  "app/api/platform/growth/engagement-dashboard/timeline/route.ts",
  "app/api/platform/growth/engagement-dashboard/lead/[leadId]/route.ts",
  "app/api/platform/growth/engagement-dashboard/templates/[templateId]/route.ts",
  "app/api/platform/growth/engagement-dashboard/media/[mediaAssetId]/route.ts",
  "app/api/platform/growth/engagement-dashboard/share-pages/[sharePageId]/route.ts",
  "components/growth/engagement/growth-engagement-timeline-panel.tsx",
  "components/growth/engagement/growth-engagement-timeline-item.tsx",
  "components/growth/engagement/growth-engagement-drilldown-drawer.tsx",
  "components/growth/engagement/growth-engagement-lead-drilldown.tsx",
  "components/growth/engagement/growth-engagement-template-drilldown.tsx",
  "components/growth/engagement/growth-engagement-media-drilldown.tsx",
  "components/growth/engagement/growth-engagement-share-page-drilldown.tsx",
] as const

const S4C_MODULE_PATHS = [
  "lib/growth/engagement/growth-engagement-report-types.ts",
  "lib/growth/engagement/growth-engagement-report-utils.ts",
  "lib/growth/engagement/growth-engagement-report-service.ts",
  "lib/growth/engagement/growth-engagement-report-diagnostics.ts",
  "lib/growth/engagement/growth-engagement-report-production-diagnostics.ts",
  "app/api/platform/growth/engagement-dashboard/reports/route.ts",
  "app/api/platform/growth/engagement-dashboard/reports/[reportType]/route.ts",
  "app/api/platform/growth/engagement-dashboard/reports/[reportType]/csv/route.ts",
  "components/growth/engagement/growth-engagement-reports-panel.tsx",
  "components/growth/engagement/growth-engagement-report-card.tsx",
  "components/growth/engagement/growth-engagement-report-table.tsx",
  "components/growth/engagement/growth-engagement-export-button.tsx",
] as const

const S4D_MODULE_PATHS = [
  "lib/growth/engagement/growth-engagement-watchlist-types.ts",
  "lib/growth/engagement/growth-engagement-watchlist-utils.ts",
  "lib/growth/engagement/growth-engagement-watchlist-service.ts",
  "lib/growth/engagement/growth-engagement-alert-types.ts",
  "lib/growth/engagement/growth-engagement-alert-service.ts",
  "lib/growth/engagement/growth-engagement-watchlist-diagnostics.ts",
  "lib/growth/engagement/growth-engagement-watchlist-production-diagnostics.ts",
  "app/api/platform/growth/engagement-dashboard/watchlists/route.ts",
  "app/api/platform/growth/engagement-dashboard/watchlists/[watchlistId]/route.ts",
  "app/api/platform/growth/engagement-dashboard/alerts/route.ts",
  "app/api/platform/growth/engagement-dashboard/alerts/[alertId]/route.ts",
  "components/growth/engagement/growth-engagement-watchlists-panel.tsx",
  "components/growth/engagement/growth-engagement-watchlist-card.tsx",
  "components/growth/engagement/growth-engagement-alerts-panel.tsx",
  "components/growth/engagement/growth-engagement-alert-card.tsx",
] as const

const S4E_MODULE_PATHS = [
  "lib/growth/engagement/growth-engagement-command-center-types.ts",
  "lib/growth/engagement/growth-engagement-command-center-utils.ts",
  "lib/growth/engagement/growth-engagement-command-center-service.ts",
  "lib/growth/engagement/growth-engagement-command-center-diagnostics.ts",
  "lib/growth/engagement/growth-engagement-command-center-production-diagnostics.ts",
  "app/api/platform/growth/engagement-dashboard/command-center/route.ts",
  "app/api/platform/growth/engagement-dashboard/command-center/overview/route.ts",
  "app/api/platform/growth/engagement-dashboard/command-center/timeline/route.ts",
  "app/api/platform/growth/engagement-dashboard/command-center/high-intent/route.ts",
  "components/growth/engagement/growth-engagement-command-center.tsx",
  "components/growth/engagement/growth-engagement-command-center-header.tsx",
  "components/growth/engagement/growth-engagement-command-center-sidebar.tsx",
  "components/growth/engagement/growth-engagement-command-center-feed.tsx",
  "components/growth/engagement/growth-engagement-command-center-high-intent-panel.tsx",
  "components/growth/engagement/growth-engagement-command-center-summary.tsx",
  "app/(admin)/admin/growth/engagement/page.tsx",
] as const

const FORBIDDEN_MUTATION_PATTERNS = [
  /\.insert\(/,
  /\.update\(/,
  /\.upsert\(/,
  /\.delete\(/,
  /emitGrowthNotification/,
  /dispatchSequenceEventWake/,
  /sendPushNotification/,
  /recomputeMediaAssetEventRollup/,
  /ingestSharePageAnalytics/,
] as const

function probeModules(paths: readonly string[]): Array<{ path: string; ok: boolean }> {
  return paths.map((relativePath) => ({
    path: relativePath,
    ok: fs.existsSync(path.join(process.cwd(), relativePath)),
  }))
}

function runLocalRegression(): void {
  console.log(`\n=== S4-A local regression (${GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER, "growth-engagement-dashboard-s4a-v1")
  assert.equal(GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE, "last_30_days")
  assert.equal(GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS.read_only, true)
  assert.equal(GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS.no_db_mutations, true)
  assert.equal(GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS.no_notifications, true)
  assert.equal(GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS.no_sequence_execution, true)
  assert.equal(GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS.no_provider_execution, true)
  console.log("  ✓ QA marker and safety flags")

  for (const relativePath of MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S4-A module files exist")

  const repositorySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/engagement/growth-engagement-dashboard-repository.ts"),
    "utf8",
  )
  const serviceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/engagement/growth-engagement-dashboard-service.ts"),
    "utf8",
  )
  const routeSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/engagement-dashboard/route.ts"),
    "utf8",
  )
  const dashboardUiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/engagement/growth-engagement-dashboard.tsx"),
    "utf8",
  )

  for (const pattern of FORBIDDEN_MUTATION_PATTERNS) {
    assert.doesNotMatch(repositorySource, pattern, `repository must not match ${pattern}`)
    assert.doesNotMatch(serviceSource, pattern, `service must not match ${pattern}`)
  }
  assert.match(routeSource, /getGrowthEngagementDashboardOverview/)
  assert.match(dashboardUiSource, /\/api\/platform\/growth\/engagement-dashboard/)
  console.log("  ✓ read-only manifests and route wiring")

  const overview = aggregateOverviewFromSamples({
    sharePage: {
      sharePageIds: ["page-1"],
      views: [
        { id: "v1", share_page_id: "page-1", session_key: "sess-a", started_at: "2026-06-01T00:00:00.000Z" },
        { id: "v2", share_page_id: "page-1", session_key: "sess-b", started_at: "2026-06-02T00:00:00.000Z" },
      ],
      events: [
        { share_page_id: "page-1", event_type: "SHARE_PAGE_VIEWED", occurred_at: "2026-06-01T00:00:00.000Z", metadata: {} },
        { share_page_id: "page-1", event_type: "SHARE_PAGE_CTA_CLICKED", occurred_at: "2026-06-01T00:01:00.000Z", metadata: {} },
      ],
      totalSharePageViews: 2,
      uniqueSharePageVisitors: 2,
      ctaClicks: 1,
      bookingStarts: 0,
      bookingCompletions: 0,
      templateUsageCount: 1,
    },
    mediaRows: rollupRowsFromSampleEvents(
      [
        {
          assetId: "asset-1",
          views: 4,
          uniqueViews: 3,
          playStarts: 2,
          completions: 1,
          ctaClicks: 1,
          averageWatchSeconds: 30,
          completionRate: 0.5,
          lastEventAt: "2026-06-02T00:00:00.000Z",
        },
      ],
      { "asset-1": "Demo video" },
    ),
  })

  assert.equal(overview.totalSharePageViews, 2)
  assert.equal(overview.uniqueSharePageVisitors, 2)
  assert.equal(overview.ctaClicks, 1)
  assert.equal(overview.mediaViews, 4)
  assert.equal(overview.mediaCtaClicks, 1)
  assert.equal(computeMediaCompletionRate(2, 1), 0.5)

  const dateRange = resolveEngagementDashboardDateRange({ dateRange: "last_30_days" })
  assert.equal(dateRange.preset, "last_30_days")
  console.log("  ✓ deterministic read-model math")

  const missingSourceOverview = aggregateOverviewFromSamples({ sharePage: null, mediaRows: [] })
  assert.equal(missingSourceOverview.totalSharePageViews, 0)
  assert.equal(missingSourceOverview.mediaViews, 0)
  console.log("  ✓ graceful missing-source behavior")
}

function runS4BLocalRegression(): void {
  console.log(`\n=== S4-B local regression (${GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER, "growth-engagement-timeline-s4b-v1")
  assert.equal(GROWTH_ENGAGEMENT_TIMELINE_EVENT_TYPES.length, 12)
  assert.equal(clampEngagementTimelineLimit(999), 200)
  assert.equal(clampEngagementTimelineLimit(0), 1)
  console.log("  ✓ QA marker, event types, and limit safety")

  for (const relativePath of S4B_MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S4-B module files exist")

  const timelineRepoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/engagement/growth-engagement-timeline-repository.ts"),
    "utf8",
  )
  const timelineRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/engagement-dashboard/timeline/route.ts"),
    "utf8",
  )
  const dashboardUiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/engagement/growth-engagement-dashboard.tsx"),
    "utf8",
  )

  for (const pattern of FORBIDDEN_MUTATION_PATTERNS) {
    assert.doesNotMatch(timelineRepoSource, pattern, `timeline repository must not match ${pattern}`)
  }
  assert.match(timelineRouteSource, /getGrowthEngagementTimeline/)
  assert.match(dashboardUiSource, /GrowthEngagementTimelinePanel/)
  assert.match(dashboardUiSource, /GrowthEngagementDrilldownDrawer/)
  console.log("  ✓ timeline routes, drilldown UI, and no mutation imports")

  assert.equal(mapSharePageEventType("SHARE_PAGE_VIEWED"), "share_page_viewed")
  assert.equal(mapMediaEventType("video_completed"), "media_completed")

  const sampleEvents = [
    {
      eventId: "a",
      eventType: "share_page_viewed" as const,
      occurredAt: "2026-06-03T00:00:00.000Z",
      leadId: "lead-1",
      sharePageId: "page-1",
      templateId: null,
      mediaAssetId: null,
      ctaKey: null,
      sessionId: null,
      title: "Share page viewed",
      description: "Share page viewed",
      metadata: {},
      source: "share_page_event" as const,
    },
    {
      eventId: "b",
      eventType: "media_completed" as const,
      occurredAt: "2026-06-02T00:00:00.000Z",
      leadId: "lead-1",
      sharePageId: null,
      templateId: null,
      mediaAssetId: "asset-1",
      ctaKey: null,
      sessionId: "sess-1",
      title: "Media completed",
      description: "Media completed",
      metadata: {},
      source: "media_asset_event" as const,
    },
  ]

  const filtered = filterEngagementTimelineEvents(sampleEvents, { leadId: "lead-1", eventType: "media_completed" })
  assert.equal(filtered.length, 1)

  const page = paginateEngagementTimelineEvents(sampleEvents, { limit: 1 })
  assert.equal(page.returned, 1)
  assert.ok(page.hasMore)
  const cursor = encodeEngagementTimelineCursor(page.items[0]!)
  assert.deepEqual(decodeEngagementTimelineCursor(cursor), {
    occurredAt: page.items[0]!.occurredAt,
    eventId: page.items[0]!.eventId,
  })

  const summary = summarizeLeadDrilldown(sampleEvents, "lead-1")
  assert.equal(summary.sharePageViews, 1)
  assert.equal(summary.mediaCompletions, 1)
  console.log("  ✓ timeline normalization, filters, cursor, and drilldown summary")
}

function runS4CLocalRegression(): void {
  console.log(`\n=== S4-C local regression (${GROWTH_ENGAGEMENT_REPORT_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_ENGAGEMENT_REPORT_QA_MARKER, "growth-engagement-report-s4c-v1")
  assert.equal(GROWTH_ENGAGEMENT_REPORT_TYPES.length, 7)
  assert.equal(clampEngagementReportLimit(999), 500)
  assert.equal(clampEngagementReportLimit(0), 1)
  assert.equal(parseEngagementReportType("overview"), "overview")
  assert.equal(parseEngagementReportType("invalid"), null)
  assert.equal(GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS.read_only, true)
  assert.equal(GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS.no_db_mutations, true)
  assert.equal(GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS.no_file_writes, true)
  assert.equal(GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS.no_notifications, true)
  console.log("  ✓ QA marker, report types, limit safety, and safety flags")

  for (const relativePath of S4C_MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S4-C module files exist")

  const reportServiceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/engagement/growth-engagement-report-service.ts"),
    "utf8",
  )
  const reportRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/engagement-dashboard/reports/[reportType]/route.ts"),
    "utf8",
  )
  const csvRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/engagement-dashboard/reports/[reportType]/csv/route.ts"),
    "utf8",
  )
  const dashboardUiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/engagement/growth-engagement-dashboard.tsx"),
    "utf8",
  )

  for (const pattern of FORBIDDEN_MUTATION_PATTERNS) {
    assert.doesNotMatch(reportServiceSource, pattern, `report service must not match ${pattern}`)
  }
  assert.doesNotMatch(reportServiceSource, /writeFile|createWriteStream|fs\.write/)
  assert.match(reportRouteSource, /getGrowthEngagementReport/)
  assert.match(csvRouteSource, /getGrowthEngagementReportCsv/)
  assert.match(dashboardUiSource, /GrowthEngagementReportsPanel/)
  console.log("  ✓ report routes, UI wiring, and no mutation/file-write imports")

  const sampleReport = {
    reportId: "overview:test",
    reportType: "overview" as const,
    title: "Engagement overview",
    description: "Test",
    dateRange: { preset: "last_30_days" as const, startIso: "2026-05-01T00:00:00.000Z", endIso: "2026-06-01T00:00:00.000Z" },
    filters: { organizationId: "org-1", dateRange: "last_30_days" as const },
    columns: [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Value" },
    ],
    rows: rowsFromColumns(
      [
        { key: "metric", label: "Metric" },
        { key: "value", label: "Value" },
      ],
      [{ metric: "CTA clicks", value: 3 }],
    ),
    totals: { total_cta_clicks: 3 },
    sourceAvailability: {},
    generatedAt: "2026-06-01T00:00:00.000Z",
    safety: GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS,
  }

  const csv = buildEngagementReportCsvExport(sampleReport)
  const csvText = renderEngagementReportCsvText(csv)
  assert.equal(csv.headers.length, 2)
  assert.equal(csv.rows.length, 1)
  assert.equal(csv.mimeType, "text/csv")
  assert.match(csvText, /Metric,Value/)
  assert.match(csv.filename, /overview/)
  console.log("  ✓ CSV generation and export model")
}

function runS4DLocalRegression(): void {
  console.log(`\n=== S4-D local regression (${GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER, "growth-engagement-watchlist-s4d-v1")
  assert.equal(GROWTH_ENGAGEMENT_ALERT_QA_MARKER, "growth-engagement-alert-s4d-v1")
  assert.equal(GROWTH_ENGAGEMENT_PREDEFINED_WATCHLISTS.length, 4)
  assert.equal(GROWTH_ENGAGEMENT_ALERT_TYPES.length, 10)
  assert.equal(clampEngagementAlertLimit(999), 500)
  assert.equal(clampEngagementAlertLimit(0), 1)
  assert.equal(parseEngagementAlertType("high_intent_detected"), "high_intent_detected")
  assert.equal(parseEngagementAlertType("invalid"), null)
  assert.equal(resolveEngagementAlertSeverity("booking_completed"), "critical")
  assert.equal(resolveEngagementAlertSeverity("repeat_viewer"), "low")
  assert.equal(GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS.no_background_jobs, true)
  assert.equal(GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS.no_notifications, true)
  console.log("  ✓ QA markers, watchlists, alert types, limits, and safety flags")

  for (const relativePath of S4D_MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S4-D module files exist")

  const alertServiceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/engagement/growth-engagement-alert-service.ts"),
    "utf8",
  )
  const alertsRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/engagement-dashboard/alerts/route.ts"),
    "utf8",
  )
  const dashboardUiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/engagement/growth-engagement-dashboard.tsx"),
    "utf8",
  )

  for (const pattern of FORBIDDEN_MUTATION_PATTERNS) {
    assert.doesNotMatch(alertServiceSource, pattern, `alert service must not match ${pattern}`)
  }
  assert.doesNotMatch(alertServiceSource, /emitGrowthNotification|sendPushNotification/)
  assert.match(alertsRouteSource, /listGrowthEngagementAlerts/)
  assert.match(dashboardUiSource, /GrowthEngagementWatchlistsPanel/)
  assert.match(dashboardUiSource, /GrowthEngagementAlertsPanel/)
  console.log("  ✓ alert routes, UI wiring, and no mutation/provider imports")

  assert.ok(
    alertMatchesWatchlist(
      {
        alertId: "test",
        watchlistId: null,
        alertType: "meeting_ready",
        title: "Test",
        description: "Test",
        severity: "critical",
        entityType: "lead",
        entityId: "lead-1",
        occurredAt: "2026-06-01T00:00:00.000Z",
        metadata: {},
        source: "timeline_event",
        acknowledged: false,
      },
      GROWTH_ENGAGEMENT_PREDEFINED_WATCHLISTS[0]!,
    ),
  )
  console.log("  ✓ watchlist rule matching and severity assignment")
}

function runS4ELocalRegression(): void {
  console.log(`\n=== S4-E local regression (${GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER, "growth-engagement-command-center-s4e-v1")
  assert.equal(GROWTH_ENGAGEMENT_COMMAND_CENTER_HIGH_INTENT_ALERT_TYPES.length, 8)
  assert.equal(clampEngagementCommandCenterLimit(999), 500)
  assert.equal(clampEngagementCommandCenterLimit(0), 1)
  assert.equal(GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS.no_background_jobs, true)
  assert.equal(GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS.no_notifications, true)
  console.log("  ✓ QA marker, high-intent card types, limits, and safety flags")

  for (const relativePath of S4E_MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S4-E module files exist")

  const serviceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/engagement/growth-engagement-command-center-service.ts"),
    "utf8",
  )
  const routeSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/engagement-dashboard/command-center/route.ts"),
    "utf8",
  )
  const pageSource = fs.readFileSync(path.join(process.cwd(), "app/(admin)/admin/growth/engagement/page.tsx"), "utf8")

  for (const pattern of FORBIDDEN_MUTATION_PATTERNS) {
    assert.doesNotMatch(serviceSource, pattern, `command center service must not match ${pattern}`)
  }
  assert.doesNotMatch(serviceSource, /emitGrowthNotification|sendPushNotification/)
  assert.match(routeSource, /getGrowthEngagementCommandCenter/)
  assert.match(pageSource, /GrowthEngagementCommandCenter/)
  console.log("  ✓ command center routes, page wiring, and no mutation/provider imports")

  const feed = buildCommandCenterFeed({
    timelineEvents: [],
    alerts: [],
    reportSummaries: [{ reportType: "overview", title: "Overview", rowCount: 2, totals: {} }],
    highIntentCards: [],
    filters: { organizationId: "org-1", dateRange: "last_30_days", limit: 10 },
  })
  assert.equal(feed.items.length, 1)
  assert.equal(feed.limit, 10)
  console.log("  ✓ feed composition and pagination helpers")
}

async function runProductionRegression(): Promise<void> {
  console.log(`\n=== S4-A production regression (${GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER}) ===\n`)

  const { bootstrapGrowthOperatorNotificationsCertEnv } = await import(
    "../lib/growth/notifications/growth-notification-cert-bootstrap"
  )
  const {
    GROWTH_ENGAGEMENT_DASHBOARD_ROUTE_MODULES,
    GROWTH_ENGAGEMENT_DASHBOARD_UI_MODULES,
    runGrowthEngagementDashboardProductionDiagnostics,
  } = await import("../lib/growth/engagement/growth-engagement-dashboard-production-diagnostics")
  const {
    GROWTH_ENGAGEMENT_TIMELINE_ROUTE_MODULES,
    GROWTH_ENGAGEMENT_TIMELINE_UI_MODULES,
    runGrowthEngagementTimelineProductionDiagnostics,
  } = await import("../lib/growth/engagement/growth-engagement-timeline-production-diagnostics")
  const {
    GROWTH_ENGAGEMENT_REPORT_ROUTE_MODULES,
    GROWTH_ENGAGEMENT_REPORT_UI_MODULES,
    runGrowthEngagementReportProductionDiagnostics,
  } = await import("../lib/growth/engagement/growth-engagement-report-production-diagnostics")
  const {
    GROWTH_ENGAGEMENT_WATCHLIST_ROUTE_MODULES,
    GROWTH_ENGAGEMENT_WATCHLIST_UI_MODULES,
    runGrowthEngagementWatchlistProductionDiagnostics,
  } = await import("../lib/growth/engagement/growth-engagement-watchlist-production-diagnostics")
  const {
    GROWTH_ENGAGEMENT_COMMAND_CENTER_ROUTE_MODULES,
    GROWTH_ENGAGEMENT_COMMAND_CENTER_UI_MODULES,
    runGrowthEngagementCommandCenterProductionDiagnostics,
  } = await import("../lib/growth/engagement/growth-engagement-command-center-production-diagnostics")

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    throw new Error("production_supabase_unavailable")
  }

  const production = await runGrowthEngagementDashboardProductionDiagnostics(boot.admin, probeModules)
  const timelineProduction = await runGrowthEngagementTimelineProductionDiagnostics(boot.admin, probeModules)
  const reportProduction = await runGrowthEngagementReportProductionDiagnostics(boot.admin, probeModules)
  const watchlistProduction = await runGrowthEngagementWatchlistProductionDiagnostics(boot.admin, probeModules)
  const commandCenterProduction = await runGrowthEngagementCommandCenterProductionDiagnostics(boot.admin, probeModules)
  assert.equal(production.read_only, true)
  assert.equal(production.no_db_mutations, true)
  assert.equal(timelineProduction.read_only, true)
  assert.equal(timelineProduction.no_db_mutations, true)
  assert.equal(reportProduction.read_only, true)
  assert.equal(reportProduction.no_db_mutations, true)
  assert.equal(reportProduction.no_file_writes, true)
  assert.equal(watchlistProduction.read_only, true)
  assert.equal(watchlistProduction.no_db_mutations, true)
  assert.equal(watchlistProduction.no_background_jobs, true)
  assert.equal(commandCenterProduction.read_only, true)
  assert.equal(commandCenterProduction.no_db_mutations, true)
  assert.equal(commandCenterProduction.no_background_jobs, true)
  assert.ok(production.routeModules.every((entry) => entry.ok))
  assert.ok(production.uiModules.every((entry) => entry.ok))
  assert.ok(timelineProduction.routeModules.every((entry) => entry.ok))
  assert.ok(timelineProduction.uiModules.every((entry) => entry.ok))
  assert.ok(reportProduction.routeModules.every((entry) => entry.ok))
  assert.ok(reportProduction.uiModules.every((entry) => entry.ok))
  assert.ok(watchlistProduction.routeModules.every((entry) => entry.ok))
  assert.ok(watchlistProduction.uiModules.every((entry) => entry.ok))
  assert.ok(commandCenterProduction.routeModules.every((entry) => entry.ok))
  assert.ok(commandCenterProduction.uiModules.every((entry) => entry.ok))
  console.log("  ✓ production route/UI modules and safety flags")

  for (const key of Object.keys(production.sourceAvailability)) {
    assert.equal(typeof production.sourceAvailability[key as keyof typeof production.sourceAvailability].source_available, "boolean")
  }
  for (const key of Object.keys(reportProduction.sourceAvailability)) {
    assert.equal(
      typeof reportProduction.sourceAvailability[key as keyof typeof reportProduction.sourceAvailability].source_available,
      "boolean",
    )
  }
  for (const key of Object.keys(watchlistProduction.sourceAvailability)) {
    assert.equal(
      typeof watchlistProduction.sourceAvailability[key as keyof typeof watchlistProduction.sourceAvailability].source_available,
      "boolean",
    )
  }
  for (const key of Object.keys(commandCenterProduction.sourceAvailability)) {
    assert.equal(
      typeof commandCenterProduction.sourceAvailability[key as keyof typeof commandCenterProduction.sourceAvailability]
        .source_available,
      "boolean",
    )
  }
  console.log("  ✓ source availability probes")

  assert.deepEqual(GROWTH_ENGAGEMENT_DASHBOARD_ROUTE_MODULES.length, 4)
  assert.deepEqual(GROWTH_ENGAGEMENT_DASHBOARD_UI_MODULES.length, 6)
  assert.deepEqual(GROWTH_ENGAGEMENT_TIMELINE_ROUTE_MODULES.length, 5)
  assert.deepEqual(GROWTH_ENGAGEMENT_TIMELINE_UI_MODULES.length, 7)
  assert.deepEqual(GROWTH_ENGAGEMENT_REPORT_ROUTE_MODULES.length, 3)
  assert.deepEqual(GROWTH_ENGAGEMENT_REPORT_UI_MODULES.length, 4)
  assert.deepEqual(GROWTH_ENGAGEMENT_WATCHLIST_ROUTE_MODULES.length, 4)
  assert.deepEqual(GROWTH_ENGAGEMENT_WATCHLIST_UI_MODULES.length, 4)
  assert.deepEqual(GROWTH_ENGAGEMENT_COMMAND_CENTER_ROUTE_MODULES.length, 4)
  assert.deepEqual(GROWTH_ENGAGEMENT_COMMAND_CENTER_UI_MODULES.length, 6)
}

async function runIntegrationRegression(): Promise<void> {
  console.log(`\n=== S4-A/S4-B integration regression ===\n`)

  const { bootstrapGrowthOperatorNotificationsCertEnv } = await import(
    "../lib/growth/notifications/growth-notification-cert-bootstrap"
  )
  const { runGrowthEngagementDashboardDiagnostics } = await import(
    "../lib/growth/engagement/growth-engagement-dashboard-diagnostics"
  )
  const { runGrowthEngagementTimelineDiagnostics } = await import(
    "../lib/growth/engagement/growth-engagement-timeline-diagnostics"
  )
  const { runGrowthEngagementReportDiagnostics } = await import(
    "../lib/growth/engagement/growth-engagement-report-diagnostics"
  )
  const { runGrowthEngagementWatchlistDiagnostics } = await import(
    "../lib/growth/engagement/growth-engagement-watchlist-diagnostics"
  )
  const { runGrowthEngagementCommandCenterDiagnostics } = await import(
    "../lib/growth/engagement/growth-engagement-command-center-diagnostics"
  )
  const { getGrowthEngineAiOrgId } = await import("../lib/growth/access")

  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    throw new Error("integration_supabase_unavailable")
  }

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    throw new Error("GROWTH_ENGINE_AI_ORG_ID is required.")
  }

  const diagnostics = await runGrowthEngagementDashboardDiagnostics(boot.admin, organizationId)
  const timelineDiagnostics = await runGrowthEngagementTimelineDiagnostics(boot.admin, organizationId)
  const reportDiagnostics = await runGrowthEngagementReportDiagnostics(boot.admin, organizationId)
  const watchlistDiagnostics = await runGrowthEngagementWatchlistDiagnostics(boot.admin, organizationId)
  const commandCenterDiagnostics = await runGrowthEngagementCommandCenterDiagnostics(boot.admin, organizationId)
  assert.equal(diagnostics.qa_marker, GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER)
  assert.equal(timelineDiagnostics.qa_marker, GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER)
  assert.equal(reportDiagnostics.qa_marker, GROWTH_ENGAGEMENT_REPORT_QA_MARKER)
  assert.equal(watchlistDiagnostics.qa_marker, GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER)
  assert.equal(commandCenterDiagnostics.qa_marker, GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER)
  assert.ok(diagnostics.checks.every((check) => check.ok), diagnostics.checks.filter((check) => !check.ok).map((check) => check.name).join(", "))
  assert.ok(
    timelineDiagnostics.checks.every((check) => check.ok),
    timelineDiagnostics.checks.filter((check) => !check.ok).map((check) => check.name).join(", "),
  )
  assert.ok(
    reportDiagnostics.checks.every((check) => check.ok),
    reportDiagnostics.checks.filter((check) => !check.ok).map((check) => check.name).join(", "),
  )
  assert.ok(
    watchlistDiagnostics.checks.every((check) => check.ok),
    watchlistDiagnostics.checks.filter((check) => !check.ok).map((check) => check.name).join(", "),
  )
  assert.ok(
    commandCenterDiagnostics.checks.every((check) => check.ok),
    commandCenterDiagnostics.checks.filter((check) => !check.ok).map((check) => check.name).join(", "),
  )
  console.log("  ✓ read-only dashboard + timeline + report + watchlist + command center diagnostics against linked project")
}

async function main(): Promise<void> {
  const mode = process.argv.includes("--production")
    ? "production"
    : process.argv.includes("--integration")
      ? "integration"
      : "local"

  if (mode === "local") {
    runLocalRegression()
    runS4BLocalRegression()
    runS4CLocalRegression()
    runS4DLocalRegression()
    runS4ELocalRegression()
    console.log("\nS4-A/S4-B/S4-C/S4-D/S4-E engagement dashboard local certification PASS\n")
    return
  }

  if (mode === "production") {
    await runProductionRegression()
    console.log("\nS4-A/S4-B/S4-C/S4-D/S4-E engagement dashboard production certification PASS\n")
    return
  }

  await runIntegrationRegression()
  console.log("\nS4-A/S4-B/S4-C/S4-D/S4-E engagement dashboard integration certification PASS\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
