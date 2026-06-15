/** Client-safe Growth Engine engagement attribution types (Phase 2E). */

export const GROWTH_ENGAGEMENT_ATTRIBUTION_QA_MARKER = "growth-engagement-attribution-v1" as const

export const GROWTH_ENGAGEMENT_ATTRIBUTION_PRIVACY_NOTE =
  "First-party open and click tracking only. Providers transport email; Growth Engine owns engagement intelligence. No third-party pixels or autonomous actions."

export const GROWTH_TRACKING_TIMELINE_EVENT_TYPES = [
  "email_opened",
  "email_clicked",
  "engagement_increased",
  "high_engagement_detected",
] as const

export type GrowthTrackingTimelineEventType = (typeof GROWTH_TRACKING_TIMELINE_EVENT_TYPES)[number]

export const GROWTH_ATTRIBUTION_ENGAGEMENT_TIERS = ["cold", "warm", "engaged", "hot"] as const
export type GrowthAttributionEngagementTier = (typeof GROWTH_ATTRIBUTION_ENGAGEMENT_TIERS)[number]

export type GrowthEmailOpenRecord = {
  id: string
  deliveryAttemptId: string
  leadId: string | null
  senderAccountId: string
  providerId: string
  openedAt: string
  userAgent: string | null
  deviceType: string | null
  country: string | null
  city: string | null
}

export type GrowthEmailClickRecord = {
  id: string
  deliveryAttemptId: string
  leadId: string | null
  senderAccountId: string
  providerId: string
  destinationUrl: string
  clickedAt: string
  userAgent: string | null
  deviceType: string | null
  country: string | null
}

export type GrowthEngagementScoreRecord = {
  id: string
  leadId: string
  score: number
  tier: GrowthAttributionEngagementTier
  opens: number
  clicks: number
  meetings: number
  replies: number
  pageViews: number
  pageEngaged: number
  pageCtaClicks: number
  pageBookingsCompleted: number
  lastActivityAt: string | null
  updatedAt: string
}

export type GrowthAttributionRates = {
  sentCount: number
  openCount: number
  clickCount: number
  replyCount: number
  meetingCount: number
  openRate: number
  clickRate: number
  replyRate: number
  meetingRate: number
}

export type GrowthTrackingHealthSnapshot = {
  qa_marker: typeof GROWTH_ENGAGEMENT_ATTRIBUTION_QA_MARKER
  schema_ready: boolean
  tracking_enabled: boolean
  open_events_24h: number
  click_events_24h: number
  attribution_health: "healthy" | "degraded" | "critical"
  notes: string[]
}

export type GrowthLeadTrackingDetail = {
  score: GrowthEngagementScoreRecord | null
  opens: GrowthEmailOpenRecord[]
  clicks: GrowthEmailClickRecord[]
  timeline: Array<{
    id: string
    kind: string
    title: string
    summary: string | null
    occurredAt: string
  }>
}

export type GrowthEngagementAttributionDashboard = {
  qa_marker: typeof GROWTH_ENGAGEMENT_ATTRIBUTION_QA_MARKER
  rates: GrowthAttributionRates
  topEngaged: Array<{
    leadId: string
    companyName: string
    contactName: string | null
    score: number
    tier: GrowthAttributionEngagementTier
    opens: number
    clicks: number
    lastActivityAt: string | null
  }>
  trackingHealth: GrowthTrackingHealthSnapshot
}
