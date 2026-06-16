import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getGrowthEngagementDashboardHighIntent,
  getGrowthEngagementDashboardMedia,
  getGrowthEngagementDashboardOverview,
  getGrowthEngagementDashboardTemplates,
} from "@/lib/growth/engagement/growth-engagement-dashboard-service"
import {
  aggregateOverviewFromSamples,
  computeMediaCompletionRate,
  resolveEngagementDashboardDateRange,
  rollupRowsFromSampleEvents,
} from "@/lib/growth/engagement/growth-engagement-dashboard-utils"
import {
  GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE,
  GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER,
  GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS,
} from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import { probeGrowthEngagementDashboardSourceAvailability } from "@/lib/growth/engagement/growth-engagement-dashboard-repository"

export type GrowthEngagementDashboardDiagnosticsResult = {
  qa_marker: typeof GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER
  ok: boolean
  checks: Array<{ name: string; ok: boolean; detail?: string }>
  sourceAvailability: Awaited<ReturnType<typeof probeGrowthEngagementDashboardSourceAvailability>>
}

export async function runGrowthEngagementDashboardDiagnostics(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthEngagementDashboardDiagnosticsResult> {
  const checks: GrowthEngagementDashboardDiagnosticsResult["checks"] = []
  const filters = {
    organizationId,
    dateRange: GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE,
  } as const

  const sampleOverview = aggregateOverviewFromSamples({
    sharePage: {
      sharePageIds: ["page-1"],
      views: [
        { id: "v1", share_page_id: "page-1", session_key: "sess-a", started_at: "2026-06-01T00:00:00.000Z" },
        { id: "v2", share_page_id: "page-1", session_key: "sess-b", started_at: "2026-06-02T00:00:00.000Z" },
      ],
      events: [
        { share_page_id: "page-1", event_type: "SHARE_PAGE_VIEWED", occurred_at: "2026-06-01T00:00:00.000Z", metadata: {} },
        { share_page_id: "page-1", event_type: "SHARE_PAGE_CTA_CLICKED", occurred_at: "2026-06-01T00:01:00.000Z", metadata: {} },
        { share_page_id: "page-1", event_type: "SHARE_PAGE_BOOKING_STARTED", occurred_at: "2026-06-01T00:02:00.000Z", metadata: {} },
        { share_page_id: "page-1", event_type: "SHARE_PAGE_BOOKING_COMPLETED", occurred_at: "2026-06-01T00:03:00.000Z", metadata: {} },
      ],
      totalSharePageViews: 1,
      uniqueSharePageVisitors: 2,
      ctaClicks: 1,
      bookingStarts: 1,
      bookingCompletions: 1,
      templateUsageCount: 1,
    },
    mediaRows: rollupRowsFromSampleEvents(
      [
        {
          assetId: "asset-1",
          views: 10,
          uniqueViews: 8,
          playStarts: 6,
          completions: 3,
          ctaClicks: 2,
          averageWatchSeconds: 45,
          completionRate: 0.5,
          lastEventAt: "2026-06-02T00:00:00.000Z",
        },
      ],
      { "asset-1": "Demo video" },
    ),
  })

  checks.push({
    name: "sample_overview_math",
    ok:
      sampleOverview.totalSharePageViews === 1 &&
      sampleOverview.uniqueSharePageVisitors === 2 &&
      sampleOverview.ctaClicks === 1 &&
      sampleOverview.mediaViews === 10 &&
      sampleOverview.mediaPlayStarts === 6 &&
      sampleOverview.mediaCompletions === 3 &&
      sampleOverview.mediaCtaClicks === 2,
  })

  checks.push({
    name: "completion_rate_math",
    ok: computeMediaCompletionRate(6, 3) === 0.5,
  })

  const dateRange = resolveEngagementDashboardDateRange(filters)
  checks.push({
    name: "default_date_range",
    ok: dateRange.preset === GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE,
  })

  checks.push({
    name: "safety_flags",
    ok:
      GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS.read_only === true &&
      GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS.no_db_mutations === true &&
      GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS.no_notifications === true,
  })

  const sourceAvailability = await probeGrowthEngagementDashboardSourceAvailability(admin)
  checks.push({
    name: "source_availability_probe",
    ok: typeof sourceAvailability.share_pages.source_available === "boolean",
  })

  const [overview, templates, media, highIntent] = await Promise.all([
    getGrowthEngagementDashboardOverview(admin, filters),
    getGrowthEngagementDashboardTemplates(admin, filters),
    getGrowthEngagementDashboardMedia(admin, filters),
    getGrowthEngagementDashboardHighIntent(admin, filters),
  ])

  checks.push({
    name: "overview_service",
    ok: overview.qa_marker === GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER && overview.read_only === true,
  })
  checks.push({
    name: "templates_service",
    ok: Array.isArray(templates.items) && templates.no_db_mutations === true,
  })
  checks.push({
    name: "media_service",
    ok: typeof media.totals.views === "number" && media.no_sequence_execution === true,
  })
  checks.push({
    name: "high_intent_service",
    ok: Array.isArray(highIntent.items) && highIntent.no_provider_execution === true,
  })

  return {
    qa_marker: GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER,
    ok: checks.every((check) => check.ok),
    checks,
    sourceAvailability,
  }
}
