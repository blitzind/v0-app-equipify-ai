import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveSendrAnalyticsDateRange } from "@/lib/growth/sendr/growth-sendr-analytics-date-range"
import { buildSendrAnalyticsPageAttention } from "@/lib/growth/sendr/growth-sendr-analytics-attention"
import {
  countPublishedSendrPages,
  countSendrEngagementEventsByTypeInRange,
  countSendrLaunchesInRange,
  loadSendrPageEngagementSummaryInRange,
  sumSendrEngagementRollupsByTypeInRange,
} from "@/lib/growth/sendr/growth-sendr-analytics-read-repository"
import { listGrowthSendrLandingPages } from "@/lib/growth/sendr/growth-sendr-landing-page-repository"
import type {
  GrowthSendrAnalyticsDateRange,
  GrowthSendrAnalyticsWorkspaceSummary,
} from "@/lib/growth/sendr/growth-sendr-types"
import { getSendrAnalyticsLaunches } from "@/lib/growth/sendr/growth-sendr-analytics-launches-service"
import { getSendrAnalyticsPages } from "@/lib/growth/sendr/growth-sendr-analytics-pages-service"
import { getSendrAnalyticsProspects } from "@/lib/growth/sendr/growth-sendr-analytics-prospects-service"

const OVERVIEW_EVENT_TYPES = [
  "page_view",
  "cta_click",
  "booking_started",
  "booking_completed",
] as const

export async function getSendrAnalyticsWorkspaceSummary(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dateRange: GrowthSendrAnalyticsDateRange
  },
): Promise<GrowthSendrAnalyticsWorkspaceSummary> {
  const rollupCounts = await sumSendrEngagementRollupsByTypeInRange(admin, {
    organizationId: input.organizationId,
    dateRange: input.dateRange,
    eventTypes: [...OVERVIEW_EVENT_TYPES],
  })

  async function eventCount(eventType: string): Promise<number> {
    const rollup = rollupCounts[eventType] ?? 0
    if (rollup > 0) return rollup
    return countSendrEngagementEventsByTypeInRange(admin, {
      organizationId: input.organizationId,
      dateRange: input.dateRange,
      eventType,
    })
  }

  const [pagesPublished, launches, publicViews, ctaClicks, bookingsStarted, bookingsCompleted, topPagesResult, prospectsResult, launchesResult] =
    await Promise.all([
      countPublishedSendrPages(admin, input.organizationId),
      countSendrLaunchesInRange(admin, {
        organizationId: input.organizationId,
        dateRange: input.dateRange,
      }),
      eventCount("page_view"),
      eventCount("cta_click"),
      eventCount("booking_started"),
      eventCount("booking_completed"),
      getSendrAnalyticsPages(admin, {
        organizationId: input.organizationId,
        dateRange: input.dateRange,
        sort: "views",
        page: 1,
        pageSize: 5,
      }),
      getSendrAnalyticsProspects(admin, {
        organizationId: input.organizationId,
        dateRange: input.dateRange,
        page: 1,
        pageSize: 5,
      }),
      getSendrAnalyticsLaunches(admin, {
        organizationId: input.organizationId,
        dateRange: input.dateRange,
        attentionOnly: true,
        page: 1,
        pageSize: 5,
      }),
    ])

  const { items: pages } = await listGrowthSendrLandingPages(admin, {
    organizationId: input.organizationId,
    limit: 50,
  })

  const pagesNeedingAttention = []
  for (const page of pages) {
    const summary = await loadSendrPageEngagementSummaryInRange(admin, {
      organizationId: input.organizationId,
      landingPageId: page.id,
      dateRange: input.dateRange,
    })
    const attention = buildSendrAnalyticsPageAttention({
      landingPageId: page.id,
      title: page.title,
      slug: page.publishedSlug ?? page.slug,
      status: page.status,
      publishedAt: page.publishedAt,
      views: summary.views,
      ctaClicks: summary.ctaClicks,
      bookings: summary.bookingsCompleted,
      lastActivityAt: summary.lastActivityAt,
    })
    if (attention) pagesNeedingAttention.push(attention)
  }

  return {
    overview: {
      pagesPublished,
      launches,
      publicViews,
      ctaClicks,
      bookingsStarted,
      bookingsCompleted,
      highIntentProspects: prospectsResult.total,
    },
    topPages: topPagesResult.items,
    highIntentProspects: prospectsResult.items,
    launchesNeedingAttention: launchesResult.items,
    pagesNeedingAttention: pagesNeedingAttention.slice(0, 5),
    dateRange: input.dateRange,
  }
}

export function parseSendrAnalyticsWorkspaceInput(searchParams: URLSearchParams) {
  return resolveSendrAnalyticsDateRange({
    preset: searchParams.get("dateRange"),
    startAt: searchParams.get("startAt"),
    endAt: searchParams.get("endAt"),
  })
}
