import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveSendrAnalyticsDateRange } from "@/lib/growth/sendr/growth-sendr-analytics-date-range"
import {
  computeFunnelRates,
  countSendrEngagementEventsByTypeInRange,
  countSendrLaunchesInRange,
  sumSendrEngagementRollupsByTypeInRange,
} from "@/lib/growth/sendr/growth-sendr-analytics-read-repository"
import type {
  GrowthSendrAnalyticsDateRange,
  GrowthSendrAnalyticsFunnel,
} from "@/lib/growth/sendr/growth-sendr-types"

const FUNNEL_EVENT_TYPES = [
  "page_view",
  "video_start",
  "video_complete",
  "cta_click",
  "booking_started",
  "booking_completed",
] as const

const FUNNEL_LABELS: Record<string, string> = {
  launches: "Launch",
  page_view: "Page View",
  video_start: "Video Start",
  video_complete: "Video Complete",
  cta_click: "CTA Click",
  booking_started: "Booking Started",
  booking_completed: "Booking Completed",
}

export async function getSendrAnalyticsFunnel(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dateRange: GrowthSendrAnalyticsDateRange
  },
): Promise<GrowthSendrAnalyticsFunnel> {
  const [launches, rollupCounts] = await Promise.all([
    countSendrLaunchesInRange(admin, {
      organizationId: input.organizationId,
      dateRange: input.dateRange,
    }),
    sumSendrEngagementRollupsByTypeInRange(admin, {
      organizationId: input.organizationId,
      dateRange: input.dateRange,
      eventTypes: [...FUNNEL_EVENT_TYPES],
    }),
  ])

  const eventCounts: Record<string, number> = { ...rollupCounts }
  for (const eventType of FUNNEL_EVENT_TYPES) {
    if (eventCounts[eventType] > 0) continue
    eventCounts[eventType] = await countSendrEngagementEventsByTypeInRange(admin, {
      organizationId: input.organizationId,
      dateRange: input.dateRange,
      eventType,
    })
  }

  const rawSteps = [
    { key: "launches", count: launches },
    { key: "page_view", count: eventCounts.page_view ?? 0 },
    { key: "video_start", count: eventCounts.video_start ?? 0 },
    { key: "video_complete", count: eventCounts.video_complete ?? 0 },
    { key: "cta_click", count: eventCounts.cta_click ?? 0 },
    { key: "booking_started", count: eventCounts.booking_started ?? 0 },
    { key: "booking_completed", count: eventCounts.booking_completed ?? 0 },
  ]

  const rated = computeFunnelRates(rawSteps)

  return {
    dateRange: input.dateRange,
    steps: rated.map((step) => ({
      key: step.key,
      label: FUNNEL_LABELS[step.key] ?? step.key,
      count: step.count,
      conversionPercent: step.conversionPercent,
      dropOffPercent: step.dropOffPercent,
    })),
  }
}

export function parseSendrAnalyticsFunnelInput(searchParams: URLSearchParams) {
  return resolveSendrAnalyticsDateRange({
    preset: searchParams.get("dateRange"),
    startAt: searchParams.get("startAt"),
    endAt: searchParams.get("endAt"),
  })
}
