import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_SENDR_LIMITS } from "@/lib/growth/sendr/growth-sendr-config"
import type { GrowthSendrAnalyticsDateRange } from "@/lib/growth/sendr/growth-sendr-types"

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_engagement_events")
}

function rollupsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_engagement_event_rollups")
}

function rollupDateFromIso(iso: string): string {
  return iso.slice(0, 10)
}

export async function countSendrEngagementEventsByTypeInRange(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dateRange: GrowthSendrAnalyticsDateRange
    eventType: string
    landingPageId?: string | null
  },
): Promise<number> {
  let query = eventsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .eq("event_type", input.eventType)
    .gte("created_at", input.dateRange.startAt)
    .lte("created_at", input.dateRange.endAt)

  if (input.landingPageId) {
    query = query.eq("landing_page_id", input.landingPageId)
  }

  const { count, error } = await query
  if (error?.message?.includes("does not exist")) return 0
  if (error) return 0
  return count ?? 0
}

export async function sumSendrEngagementRollupsByTypeInRange(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dateRange: GrowthSendrAnalyticsDateRange
    eventTypes: string[]
  },
): Promise<Record<string, number>> {
  const result: Record<string, number> = {}
  for (const eventType of input.eventTypes) {
    result[eventType] = 0
  }

  const { data, error } = await rollupsTable(admin)
    .select("event_type, event_count, rollup_date")
    .eq("organization_id", input.organizationId)
    .gte("rollup_date", rollupDateFromIso(input.dateRange.startAt))
    .lte("rollup_date", rollupDateFromIso(input.dateRange.endAt))
    .in("event_type", input.eventTypes)

  if (error?.message?.includes("does not exist")) return result
  if (error) return result

  for (const row of data ?? []) {
    const typed = row as { event_type: string; event_count: number }
    result[typed.event_type] = (result[typed.event_type] ?? 0) + Number(typed.event_count ?? 0)
  }
  return result
}

export async function loadSendrPageEngagementSummaryInRange(
  admin: SupabaseClient,
  input: {
    organizationId: string
    landingPageId: string
    dateRange: GrowthSendrAnalyticsDateRange
  },
): Promise<{
  views: number
  ctaClicks: number
  bookingsStarted: number
  bookingsCompleted: number
  videoStarts: number
  videoCompletes: number
  lastActivityAt: string | null
}> {
  const limit = Math.min(GROWTH_SENDR_LIMITS.MAX_SENDR_ANALYTICS_ROWS, 1000)
  const { data, error } = await eventsTable(admin)
    .select("event_type, created_at")
    .eq("organization_id", input.organizationId)
    .eq("landing_page_id", input.landingPageId)
    .gte("created_at", input.dateRange.startAt)
    .lte("created_at", input.dateRange.endAt)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error?.message?.includes("does not exist")) {
    return {
      views: 0,
      ctaClicks: 0,
      bookingsStarted: 0,
      bookingsCompleted: 0,
      videoStarts: 0,
      videoCompletes: 0,
      lastActivityAt: null,
    }
  }

  const events = (data ?? []) as Array<{ event_type: string; created_at: string }>
  const countType = (type: string) => events.filter((e) => e.event_type === type).length

  return {
    views: countType("page_view"),
    ctaClicks: countType("cta_click"),
    bookingsStarted: countType("booking_started"),
    bookingsCompleted: countType("booking_completed"),
    videoStarts: countType("video_start"),
    videoCompletes: countType("video_complete"),
    lastActivityAt: events[0]?.created_at ?? null,
  }
}

export async function countSendrLaunchesInRange(
  admin: SupabaseClient,
  input: { organizationId: string; dateRange: GrowthSendrAnalyticsDateRange },
): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("growth_sendr_launch_runs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .gte("started_at", input.dateRange.startAt)
    .lte("started_at", input.dateRange.endAt)
  if (error?.message?.includes("does not exist")) return 0
  if (error) return 0
  return count ?? 0
}

export async function countPublishedSendrPages(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("growth_landing_pages")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "published")
    .is("deleted_at", null)
  if (error?.message?.includes("does not exist")) return 0
  if (error) return 0
  return count ?? 0
}

export function computeFunnelRates(steps: Array<{ key: string; count: number }>): Array<{
  key: string
  count: number
  conversionPercent: number | null
  dropOffPercent: number | null
}> {
  return steps.map((step, index) => {
    if (index === 0) {
      return { ...step, conversionPercent: 100, dropOffPercent: 0 }
    }
    const previous = steps[index - 1]?.count ?? 0
    if (previous <= 0) {
      return { ...step, conversionPercent: null, dropOffPercent: null }
    }
    const conversionPercent = Math.round((step.count / previous) * 100)
    return {
      ...step,
      conversionPercent,
      dropOffPercent: Math.max(0, 100 - conversionPercent),
    }
  })
}
