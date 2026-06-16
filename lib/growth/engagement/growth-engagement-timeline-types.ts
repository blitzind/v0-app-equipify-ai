/** Growth Engine S4-B — engagement timeline + drilldown read-model types. */

import type {
  GrowthEngagementDashboardSafetyFlags,
  GrowthEngagementDashboardSourceAvailability,
} from "@/lib/growth/engagement/growth-engagement-dashboard-types"

export const GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER = "growth-engagement-timeline-s4b-v1" as const

export const GROWTH_ENGAGEMENT_TIMELINE_EVENT_TYPES = [
  "share_page_viewed",
  "share_page_cta_clicked",
  "share_page_booking_started",
  "share_page_booking_completed",
  "media_viewed",
  "media_play_started",
  "media_progress",
  "media_completed",
  "media_cta_clicked",
  "template_instantiated",
  "booking_handoff_ready",
  "high_intent_detected",
] as const

export type GrowthEngagementTimelineEventType = (typeof GROWTH_ENGAGEMENT_TIMELINE_EVENT_TYPES)[number]

export type GrowthEngagementTimelineEventSource =
  | "share_page_event"
  | "share_page_view"
  | "media_asset_event"
  | "share_page_record"
  | "signal"
  | "booking_handoff_foundation"

export type GrowthEngagementTimelineEvent = {
  eventId: string
  eventType: GrowthEngagementTimelineEventType
  occurredAt: string
  leadId: string | null
  sharePageId: string | null
  templateId: string | null
  mediaAssetId: string | null
  ctaKey: string | null
  sessionId: string | null
  title: string
  description: string
  metadata: Record<string, unknown>
  source: GrowthEngagementTimelineEventSource
}

export type GrowthEngagementTimelineFilters = {
  organizationId: string
  dateRange?: string | null
  startDate?: string | null
  endDate?: string | null
  leadId?: string | null
  templateId?: string | null
  mediaAssetId?: string | null
  sharePageId?: string | null
  eventType?: GrowthEngagementTimelineEventType | null
  sessionId?: string | null
  limit?: number
  cursor?: string | null
}

export type GrowthEngagementTimelinePage = {
  items: GrowthEngagementTimelineEvent[]
  nextCursor: string | null
  limit: number
  returned: number
  hasMore: boolean
}

export type GrowthEngagementTimelineResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER
  filters: GrowthEngagementTimelineFilters
  timeline: GrowthEngagementTimelinePage
  sourceAvailability: Pick<
    GrowthEngagementDashboardSourceAvailability,
    | "share_pages"
    | "share_page_analytics"
    | "media_asset_events"
    | "share_page_templates"
    | "booking_handoff_foundation"
    | "high_intent_signals"
  >
} & GrowthEngagementDashboardSafetyFlags

export type GrowthEngagementLeadDrilldownSummary = {
  leadId: string
  sharePageViews: number
  ctaClicks: number
  bookingStarts: number
  bookingCompletions: number
  mediaViews: number
  mediaCompletions: number
  highIntentSignals: number
}

export type GrowthEngagementLeadDrilldownResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER
  leadId: string
  summary: GrowthEngagementLeadDrilldownSummary
  timeline: GrowthEngagementTimelinePage
  sourceAvailability: GrowthEngagementTimelineResponse["sourceAvailability"]
} & GrowthEngagementDashboardSafetyFlags

export type GrowthEngagementTemplateDrilldownSummary = {
  templateId: string
  templateName: string
  pagesCreated: number
  sharePageViews: number
  ctaClicks: number
  bookingStarts: number
  bookingCompletions: number
}

export type GrowthEngagementTemplateDrilldownResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER
  templateId: string
  summary: GrowthEngagementTemplateDrilldownSummary
  timeline: GrowthEngagementTimelinePage
  sourceAvailability: GrowthEngagementTimelineResponse["sourceAvailability"]
} & GrowthEngagementDashboardSafetyFlags

export type GrowthEngagementMediaDrilldownSummary = {
  mediaAssetId: string
  assetLabel: string
  views: number
  playStarts: number
  completions: number
  ctaClicks: number
  averageWatchSeconds: number
  completionRate: number
}

export type GrowthEngagementMediaDrilldownResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER
  mediaAssetId: string
  summary: GrowthEngagementMediaDrilldownSummary
  timeline: GrowthEngagementTimelinePage
  sourceAvailability: GrowthEngagementTimelineResponse["sourceAvailability"]
} & GrowthEngagementDashboardSafetyFlags

export type GrowthEngagementSharePageDrilldownSummary = {
  sharePageId: string
  leadId: string | null
  templateId: string | null
  status: string | null
  viewCount: number
  ctaClicks: number
  bookingStarts: number
  bookingCompletions: number
  firstViewedAt: string | null
  lastViewedAt: string | null
}

export type GrowthEngagementSharePageDrilldownResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER
  sharePageId: string
  summary: GrowthEngagementSharePageDrilldownSummary
  timeline: GrowthEngagementTimelinePage
  sourceAvailability: GrowthEngagementTimelineResponse["sourceAvailability"]
} & GrowthEngagementDashboardSafetyFlags

export type GrowthEngagementDrilldownKind = "lead" | "template" | "media" | "share_page"
