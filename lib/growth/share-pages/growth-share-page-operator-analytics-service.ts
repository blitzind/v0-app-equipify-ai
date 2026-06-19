/** Growth Engine SP-UX-2 — Operator workspace analytics assembly (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthSharePage,
  GrowthSharePageAnalyticsSummary,
  GrowthSharePageEvent,
} from "@/lib/growth/share-pages/share-page-types"
import type { GrowthSharePageOperatorAnalyticsPanel } from "@/lib/growth/share-pages/growth-share-page-operator-workspace-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function incrementBucket(bucket: Record<string, number>, key: string): void {
  const normalized = key.trim() || "unknown"
  bucket[normalized] = (bucket[normalized] ?? 0) + 1
}

async function loadSharePageViewBreakdowns(
  admin: SupabaseClient,
  sharePageId: string,
): Promise<GrowthSharePageOperatorAnalyticsPanel["breakdowns"]> {
  const { data, error } = await admin
    .schema("growth")
    .from("share_page_views")
    .select("referrer, device_metadata")
    .eq("share_page_id", sharePageId)
    .limit(500)

  if (error) throw new Error(error.message)

  const deviceType: Record<string, number> = {}
  const browser: Record<string, number> = {}
  const referrer: Record<string, number> = {}

  for (const row of data ?? []) {
    const metadata = (row.device_metadata ?? {}) as Record<string, unknown>
    incrementBucket(deviceType, asString(metadata.device_type) || asString(metadata.deviceType) || "unknown")
    incrementBucket(browser, asString(metadata.browser) || asString(metadata.user_agent_browser) || "unknown")
    incrementBucket(referrer, asString(row.referrer) || "direct")
  }

  return { deviceType, browser, referrer }
}

function mapEventTrendLabel(event: GrowthSharePageEvent): string {
  switch (event.eventType) {
    case "SHARE_PAGE_VIEWED":
      return "Page viewed"
    case "SHARE_PAGE_CTA_CLICKED":
      return "CTA clicked"
    case "SHARE_PAGE_BOOKING_STARTED":
      return "Calendar opened"
    case "SHARE_PAGE_BOOKING_COMPLETED":
      return "Calendar booking completed"
    default:
      return event.eventLabel || event.eventType.replace(/_/g, " ").toLowerCase()
  }
}

export async function buildGrowthSharePageOperatorAnalyticsPanel(
  admin: SupabaseClient,
  input: {
    page: GrowthSharePage
    analytics: GrowthSharePageAnalyticsSummary | null
    recentEvents: GrowthSharePageEvent[]
  },
): Promise<GrowthSharePageOperatorAnalyticsPanel> {
  const engagement = input.analytics?.engagementSummary ?? input.page.engagementSummary
  const breakdowns = await loadSharePageViewBreakdowns(admin, input.page.id)

  const trend = input.recentEvents.slice(0, 20).map((event) => ({
    occurredAt: event.occurredAt,
    label: mapEventTrendLabel(event),
    eventType: event.eventType,
  }))

  return {
    overview: {
      totalViews: engagement.viewCount,
      uniqueVisitors: engagement.uniqueSessionCount,
      timeOnPageMs: engagement.avgDurationMs,
      ctaClicks: engagement.ctaClickCount,
      calendarClicks: engagement.bookingStartedCount + engagement.bookingCompletedCount,
      lastVisitAt: input.analytics?.lastViewedAt ?? input.page.lastViewedAt,
    },
    breakdowns,
    trend,
  }
}
