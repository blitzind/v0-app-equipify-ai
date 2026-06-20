import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_SENDR_LIMITS } from "@/lib/growth/sendr/growth-sendr-config"
import { resolveSendrAnalyticsDateRange } from "@/lib/growth/sendr/growth-sendr-analytics-date-range"
import { buildSendrActivityFeedRows } from "@/lib/growth/sendr/growth-sendr-activity-feed-service"
import { getSendrHotProspects } from "@/lib/growth/sendr/growth-sendr-activity-prospects-service"
import type {
  GrowthSendrActivityWorkspaceSummary,
  GrowthSendrAnalyticsDateRange,
} from "@/lib/growth/sendr/growth-sendr-types"

export async function getSendrActivityWorkspaceSummary(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dateRange: GrowthSendrAnalyticsDateRange
  },
): Promise<GrowthSendrActivityWorkspaceSummary> {
  const [feedRows, hotProspectsResult] = await Promise.all([
    buildSendrActivityFeedRows(admin, {
      ...input,
      limit: GROWTH_SENDR_LIMITS.MAX_SENDR_ACTIVITY_FEED,
    }),
    getSendrHotProspects(admin, { ...input, sort: "intent", page: 1, pageSize: 10 }),
  ])

  const uniqueLeads = new Set(feedRows.map((r) => r.leadId).filter(Boolean))
  const pageViews = feedRows.filter((r) => r.eventType === "page_view").length
  const videoCompletes = feedRows.filter((r) => r.eventType === "video_complete").length
  const ctaClicks = feedRows.filter((r) => r.eventType === "cta_click").length
  const bookingsCompleted = feedRows.filter((r) => r.eventType === "booking_completed").length

  return {
    summary: {
      totalEvents: feedRows.length,
      uniqueLeads: uniqueLeads.size,
      pageViews,
      videoCompletes,
      ctaClicks,
      bookingsCompleted,
      hotProspects: hotProspectsResult.total,
    },
    recentActivity: feedRows.slice(0, 15),
    hotProspects: hotProspectsResult.items,
    dateRange: input.dateRange,
  }
}

export function parseSendrActivityWorkspaceInput(searchParams: URLSearchParams) {
  return resolveSendrAnalyticsDateRange({
    preset: searchParams.get("dateRange"),
    startAt: searchParams.get("startAt"),
    endAt: searchParams.get("endAt"),
  })
}
