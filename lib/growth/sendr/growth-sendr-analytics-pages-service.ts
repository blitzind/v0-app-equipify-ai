import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_SENDR_LIMITS } from "@/lib/growth/sendr/growth-sendr-config"
import { resolveSendrAnalyticsDateRange } from "@/lib/growth/sendr/growth-sendr-analytics-date-range"
import { loadSendrPageEngagementSummaryInRange } from "@/lib/growth/sendr/growth-sendr-analytics-read-repository"
import { listGrowthSendrLandingPages } from "@/lib/growth/sendr/growth-sendr-landing-page-repository"
import type {
  GrowthSendrAnalyticsDateRange,
  GrowthSendrAnalyticsPageRow,
} from "@/lib/growth/sendr/growth-sendr-types"

export type GrowthSendrAnalyticsPageSort = "views" | "conversion" | "bookings" | "recent_activity"

function sortPages(
  pages: GrowthSendrAnalyticsPageRow[],
  sort: GrowthSendrAnalyticsPageSort,
): GrowthSendrAnalyticsPageRow[] {
  const copy = [...pages]
  switch (sort) {
    case "conversion":
      return copy.sort((a, b) => b.conversionPercent - a.conversionPercent)
    case "bookings":
      return copy.sort((a, b) => b.bookings - a.bookings)
    case "recent_activity":
      return copy.sort((a, b) => {
        const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0
        const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0
        return bTime - aTime
      })
    case "views":
    default:
      return copy.sort((a, b) => b.views - a.views)
  }
}

export async function getSendrAnalyticsPages(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dateRange: GrowthSendrAnalyticsDateRange
    sort?: GrowthSendrAnalyticsPageSort
    page?: number
    pageSize?: number
  },
): Promise<{
  items: GrowthSendrAnalyticsPageRow[]
  total: number
  sort: GrowthSendrAnalyticsPageSort
  page: number
  pageSize: number
}> {
  const sort = input.sort ?? "views"
  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 100)
  const maxPages = GROWTH_SENDR_LIMITS.MAX_SENDR_ANALYTICS_PAGES

  const { items: pages } = await listGrowthSendrLandingPages(admin, {
    organizationId: input.organizationId,
    limit: maxPages,
  })

  const rows: GrowthSendrAnalyticsPageRow[] = []
  for (const pageRow of pages) {
    const summary = await loadSendrPageEngagementSummaryInRange(admin, {
      organizationId: input.organizationId,
      landingPageId: pageRow.id,
      dateRange: input.dateRange,
    })
    rows.push({
      landingPageId: pageRow.id,
      title: pageRow.title,
      slug: pageRow.publishedSlug ?? pageRow.slug,
      status: pageRow.status,
      views: summary.views,
      ctaClicks: summary.ctaClicks,
      bookings: summary.bookingsCompleted,
      conversionPercent: summary.views > 0 ? Math.round((summary.ctaClicks / summary.views) * 100) : 0,
      lastActivityAt: summary.lastActivityAt,
    })
  }

  const sorted = sortPages(rows, sort)
  const offset = (page - 1) * pageSize

  return {
    items: sorted.slice(offset, offset + pageSize),
    total: sorted.length,
    sort,
    page,
    pageSize,
  }
}

export function parseSendrAnalyticsPagesInput(searchParams: URLSearchParams) {
  const sortParam = searchParams.get("sort")
  const sort: GrowthSendrAnalyticsPageSort =
    sortParam === "conversion" ||
    sortParam === "bookings" ||
    sortParam === "recent_activity" ||
    sortParam === "views"
      ? sortParam
      : "views"

  return {
    dateRange: resolveSendrAnalyticsDateRange({
      preset: searchParams.get("dateRange"),
      startAt: searchParams.get("startAt"),
      endAt: searchParams.get("endAt"),
    }),
    sort,
    page: Number(searchParams.get("page") ?? "1"),
    pageSize: Number(searchParams.get("pageSize") ?? "25"),
  }
}
