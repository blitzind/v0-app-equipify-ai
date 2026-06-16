import { z } from "zod"
import {
  GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE,
  GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS,
  type GrowthEngagementDashboardDateRangePreset,
} from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import { resolveEngagementDashboardDateRange } from "@/lib/growth/engagement/growth-engagement-dashboard-utils"
import {
  GROWTH_ENGAGEMENT_TIMELINE_EVENT_TYPES,
  type GrowthEngagementTimelineEvent,
  type GrowthEngagementTimelineEventType,
  type GrowthEngagementTimelineFilters,
  type GrowthEngagementTimelinePage,
} from "@/lib/growth/engagement/growth-engagement-timeline-types"

export const GROWTH_ENGAGEMENT_TIMELINE_DEFAULT_LIMIT = 50 as const
export const GROWTH_ENGAGEMENT_TIMELINE_MAX_LIMIT = 200 as const

const DATE_RANGE_SCHEMA = z.enum(["last_7_days", "last_30_days", "last_90_days", "custom"])
const EVENT_TYPE_SCHEMA = z.enum(GROWTH_ENGAGEMENT_TIMELINE_EVENT_TYPES)

const SHARE_PAGE_EVENT_MAP: Record<string, GrowthEngagementTimelineEventType> = {
  SHARE_PAGE_VIEWED: "share_page_viewed",
  SHARE_PAGE_CTA_CLICKED: "share_page_cta_clicked",
  SHARE_PAGE_BOOKING_STARTED: "share_page_booking_started",
  SHARE_PAGE_BOOKING_COMPLETED: "share_page_booking_completed",
}

const MEDIA_EVENT_MAP: Record<string, GrowthEngagementTimelineEventType> = {
  video_viewed: "media_viewed",
  video_play_started: "media_play_started",
  video_progress: "media_progress",
  video_completed: "media_completed",
  video_cta_clicked: "media_cta_clicked",
}

export function clampEngagementTimelineLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return GROWTH_ENGAGEMENT_TIMELINE_DEFAULT_LIMIT
  return Math.min(Math.max(Math.floor(value ?? GROWTH_ENGAGEMENT_TIMELINE_DEFAULT_LIMIT), 1), GROWTH_ENGAGEMENT_TIMELINE_MAX_LIMIT)
}

export function parseEngagementTimelineFilters(
  organizationId: string,
  searchParams: URLSearchParams,
): GrowthEngagementTimelineFilters {
  const dateRangeRaw = searchParams.get("dateRange") ?? searchParams.get("date_range") ?? GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE
  const parsedDateRange = DATE_RANGE_SCHEMA.safeParse(dateRangeRaw)
  const dateRange: GrowthEngagementDashboardDateRangePreset = parsedDateRange.success
    ? parsedDateRange.data
    : GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE

  const eventTypeRaw = searchParams.get("eventType") ?? searchParams.get("event_type")
  const parsedEventType = eventTypeRaw ? EVENT_TYPE_SCHEMA.safeParse(eventTypeRaw) : null

  const limitRaw = searchParams.get("limit")
  const limit = limitRaw ? clampEngagementTimelineLimit(Number(limitRaw)) : GROWTH_ENGAGEMENT_TIMELINE_DEFAULT_LIMIT

  return {
    organizationId,
    dateRange,
    startDate: searchParams.get("startDate") ?? searchParams.get("start_date"),
    endDate: searchParams.get("endDate") ?? searchParams.get("end_date"),
    leadId: searchParams.get("leadId") ?? searchParams.get("lead_id"),
    templateId: searchParams.get("templateId") ?? searchParams.get("template_id"),
    mediaAssetId: searchParams.get("mediaAssetId") ?? searchParams.get("media_asset_id") ?? searchParams.get("assetId"),
    sharePageId: searchParams.get("sharePageId") ?? searchParams.get("share_page_id"),
    eventType: parsedEventType?.success ? parsedEventType.data : null,
    sessionId: searchParams.get("sessionId") ?? searchParams.get("session_id"),
    limit,
    cursor: searchParams.get("cursor"),
  }
}

export function resolveEngagementTimelineDateRange(filters: GrowthEngagementTimelineFilters) {
  return resolveEngagementDashboardDateRange({
    dateRange: (filters.dateRange as GrowthEngagementDashboardDateRangePreset | undefined) ?? GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE,
    startDate: filters.startDate,
    endDate: filters.endDate,
  })
}

export function encodeEngagementTimelineCursor(event: Pick<GrowthEngagementTimelineEvent, "occurredAt" | "eventId">): string {
  return `${event.occurredAt}|${event.eventId}`
}

export function decodeEngagementTimelineCursor(cursor: string | null | undefined): { occurredAt: string; eventId: string } | null {
  if (!cursor?.trim()) return null
  const [occurredAt, ...rest] = cursor.split("|")
  const eventId = rest.join("|")
  if (!occurredAt || !eventId) return null
  return { occurredAt, eventId }
}

export function mapSharePageEventType(raw: string): GrowthEngagementTimelineEventType | null {
  return SHARE_PAGE_EVENT_MAP[raw] ?? null
}

export function mapMediaEventType(raw: string): GrowthEngagementTimelineEventType | null {
  return MEDIA_EVENT_MAP[raw] ?? null
}

export function buildTimelineEventTitle(eventType: GrowthEngagementTimelineEventType): string {
  switch (eventType) {
    case "share_page_viewed":
      return "Share page viewed"
    case "share_page_cta_clicked":
      return "Share page CTA clicked"
    case "share_page_booking_started":
      return "Booking started"
    case "share_page_booking_completed":
      return "Booking completed"
    case "media_viewed":
      return "Media viewed"
    case "media_play_started":
      return "Media play started"
    case "media_progress":
      return "Media progress"
    case "media_completed":
      return "Media completed"
    case "media_cta_clicked":
      return "Media CTA clicked"
    case "template_instantiated":
      return "Template instantiated"
    case "booking_handoff_ready":
      return "Booking handoff ready"
    case "high_intent_detected":
      return "High-intent signal detected"
  }
}

export function paginateEngagementTimelineEvents(
  events: GrowthEngagementTimelineEvent[],
  input: { limit?: number; cursor?: string | null },
): GrowthEngagementTimelinePage {
  const limit = clampEngagementTimelineLimit(input.limit)
  const decoded = decodeEngagementTimelineCursor(input.cursor)

  const sorted = [...events].sort((a, b) => {
    const timeCompare = b.occurredAt.localeCompare(a.occurredAt)
    if (timeCompare !== 0) return timeCompare
    return b.eventId.localeCompare(a.eventId)
  })

  const filtered = decoded
    ? sorted.filter((event) => {
        if (event.occurredAt < decoded.occurredAt) return true
        if (event.occurredAt > decoded.occurredAt) return false
        return event.eventId < decoded.eventId
      })
    : sorted

  const items = filtered.slice(0, limit)
  const nextCursor = filtered.length > limit && items.at(-1) ? encodeEngagementTimelineCursor(items.at(-1)!) : null

  return {
    items,
    nextCursor,
    limit,
    returned: items.length,
    hasMore: Boolean(nextCursor),
  }
}

export function filterEngagementTimelineEvents(
  events: GrowthEngagementTimelineEvent[],
  filters: Pick<
    GrowthEngagementTimelineFilters,
    "leadId" | "templateId" | "mediaAssetId" | "sharePageId" | "eventType" | "sessionId"
  >,
): GrowthEngagementTimelineEvent[] {
  return events.filter((event) => {
    if (filters.leadId && event.leadId !== filters.leadId) return false
    if (filters.templateId && event.templateId !== filters.templateId) return false
    if (filters.mediaAssetId && event.mediaAssetId !== filters.mediaAssetId) return false
    if (filters.sharePageId && event.sharePageId !== filters.sharePageId) return false
    if (filters.eventType && event.eventType !== filters.eventType) return false
    if (filters.sessionId && event.sessionId !== filters.sessionId) return false
    return true
  })
}

export function summarizeLeadDrilldown(events: GrowthEngagementTimelineEvent[], leadId: string) {
  const scoped = events.filter((event) => event.leadId === leadId)
  return {
    leadId,
    sharePageViews: scoped.filter((event) => event.eventType === "share_page_viewed").length,
    ctaClicks: scoped.filter((event) => event.eventType === "share_page_cta_clicked").length,
    bookingStarts: scoped.filter((event) => event.eventType === "share_page_booking_started").length,
    bookingCompletions: scoped.filter((event) => event.eventType === "share_page_booking_completed").length,
    mediaViews: scoped.filter((event) => event.eventType === "media_viewed").length,
    mediaCompletions: scoped.filter((event) => event.eventType === "media_completed").length,
    highIntentSignals: scoped.filter((event) => event.eventType === "high_intent_detected").length,
  }
}

export { GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS as GROWTH_ENGAGEMENT_TIMELINE_SAFETY_FLAGS }
