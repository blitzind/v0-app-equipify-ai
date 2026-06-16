import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  countTemplatesWithBookingHandoffEnabled,
  fetchBookingHandoffFoundationCounts,
  fetchHighIntentSignals,
  fetchMediaPerformanceRows,
  fetchSharePageEngagementSnapshot,
  fetchTemplatePerformanceRows,
  probeGrowthEngagementDashboardSourceAvailability,
} from "@/lib/growth/engagement/growth-engagement-dashboard-repository"
import {
  GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER,
  GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS,
  type GrowthEngagementDashboardFilters,
  type GrowthEngagementDashboardHighIntentResponse,
  type GrowthEngagementDashboardMediaResponse,
  type GrowthEngagementDashboardOverviewMetrics,
  type GrowthEngagementDashboardOverviewResponse,
  type GrowthEngagementDashboardTemplatesResponse,
} from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import {
  aggregateMediaTotalsFromRollups,
  aggregateOverviewFromSamples,
  buildCtaPerformance,
  computeMediaCompletionRate,
  parseEngagementDashboardFilters,
  resolveEngagementDashboardDateRange,
  rollupRowsFromSampleEvents,
} from "@/lib/growth/engagement/growth-engagement-dashboard-utils"

export type EngagementDashboardPlatformAccess =
  | {
      ok: true
      admin: SupabaseClient
      userId: string
      userEmail: string | null
      organizationId: string
    }
  | { ok: false; response: NextResponse }

export async function requireEngagementDashboardPlatformAccess(): Promise<EngagementDashboardPlatformAccess> {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "organization_id_required",
          message: "GROWTH_ENGINE_AI_ORG_ID is required.",
        },
        { status: 503 },
      ),
    }
  }

  return {
    ok: true,
    admin: access.admin,
    userId: access.userId,
    userEmail: access.userEmail,
    organizationId,
  }
}

function emptyOverviewMetrics(): GrowthEngagementDashboardOverviewMetrics {
  return {
    totalSharePageViews: 0,
    uniqueSharePageVisitors: 0,
    ctaClicks: 0,
    bookingStarts: 0,
    bookingCompletions: 0,
    mediaViews: 0,
    mediaPlayStarts: 0,
    mediaCompletions: 0,
    mediaCtaClicks: 0,
    averageWatchSeconds: 0,
    completionRate: 0,
    templateUsageCount: 0,
  }
}

export async function getGrowthEngagementDashboardOverview(
  admin: SupabaseClient,
  filters: GrowthEngagementDashboardFilters,
): Promise<GrowthEngagementDashboardOverviewResponse> {
  const dateRange = resolveEngagementDashboardDateRange(filters)
  const sourceAvailability = await probeGrowthEngagementDashboardSourceAvailability(admin)

  const [sharePage, mediaRows, templateRows, templatesWithHandoff] = await Promise.all([
    fetchSharePageEngagementSnapshot(admin, filters, dateRange),
    fetchMediaPerformanceRows(admin, filters),
    fetchTemplatePerformanceRows(admin, filters, dateRange),
    countTemplatesWithBookingHandoffEnabled(admin, filters.organizationId),
  ])

  const media = mediaRows ?? []
  const overview =
    sharePage || media.length > 0
      ? aggregateOverviewFromSamples({ sharePage, mediaRows: media })
      : emptyOverviewMetrics()
  const foundationCounts = fetchBookingHandoffFoundationCounts(filters.organizationId)

  return {
    qa_marker: GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER,
    filters,
    dateRange,
    overview,
    topTemplates: (templateRows ?? []).slice(0, 10),
    topAssets: media.slice(0, 10),
    ctaPerformance: buildCtaPerformance({
      sharePageCtaClicks: overview.ctaClicks,
      mediaRows: media,
    }),
    bookingHandoffReadiness: {
      templatesWithHandoffEnabled: templatesWithHandoff ?? 0,
      sharePageBookingStarts: overview.bookingStarts,
      sharePageBookingCompletions: overview.bookingCompletions,
      foundationHandoffRecords: foundationCounts.foundationHandoffRecords,
      readyTierCount: foundationCounts.readyTierCount,
      highIntentTierCount: foundationCounts.highIntentTierCount,
      sourceAvailable: sourceAvailability.booking_handoff_foundation.source_available,
    },
    sourceAvailability,
    ...GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS,
  }
}

export async function getGrowthEngagementDashboardTemplates(
  admin: SupabaseClient,
  filters: GrowthEngagementDashboardFilters,
): Promise<GrowthEngagementDashboardTemplatesResponse> {
  const dateRange = resolveEngagementDashboardDateRange(filters)
  const sourceAvailability = await probeGrowthEngagementDashboardSourceAvailability(admin)
  const items = (await fetchTemplatePerformanceRows(admin, filters, dateRange)) ?? []

  return {
    qa_marker: GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER,
    filters,
    dateRange,
    items,
    total: items.length,
    sourceAvailability: {
      share_pages: sourceAvailability.share_pages,
      share_page_analytics: sourceAvailability.share_page_analytics,
      share_page_templates: sourceAvailability.share_page_templates,
    },
    ...GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS,
  }
}

export async function getGrowthEngagementDashboardMedia(
  admin: SupabaseClient,
  filters: GrowthEngagementDashboardFilters,
): Promise<GrowthEngagementDashboardMediaResponse> {
  const dateRange = resolveEngagementDashboardDateRange(filters)
  const sourceAvailability = await probeGrowthEngagementDashboardSourceAvailability(admin)
  const items = (await fetchMediaPerformanceRows(admin, filters)) ?? []

  return {
    qa_marker: GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER,
    filters,
    dateRange,
    items,
    totals: aggregateMediaTotalsFromRollups(items),
    sourceAvailability: {
      media_assets: sourceAvailability.media_assets,
      media_asset_events: sourceAvailability.media_asset_events,
      media_asset_event_rollups: sourceAvailability.media_asset_event_rollups,
    },
    ...GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS,
  }
}

export async function getGrowthEngagementDashboardHighIntent(
  admin: SupabaseClient,
  filters: GrowthEngagementDashboardFilters,
): Promise<GrowthEngagementDashboardHighIntentResponse> {
  const dateRange = resolveEngagementDashboardDateRange(filters)
  const sourceAvailability = await probeGrowthEngagementDashboardSourceAvailability(admin)
  const items = (await fetchHighIntentSignals(admin, filters, dateRange)) ?? []

  return {
    qa_marker: GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER,
    filters,
    dateRange,
    items,
    total: items.length,
    sourceAvailability: {
      high_intent_signals: sourceAvailability.high_intent_signals,
      share_page_analytics: sourceAvailability.share_page_analytics,
    },
    ...GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS,
  }
}

export {
  parseEngagementDashboardFilters,
  resolveEngagementDashboardDateRange,
  aggregateOverviewFromSamples,
  computeMediaCompletionRate,
  rollupRowsFromSampleEvents,
}

export { GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER, GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS }
