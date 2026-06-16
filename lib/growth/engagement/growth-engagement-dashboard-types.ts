/** Growth Engine S4-A — engagement dashboard read-model types (share page + media + booking handoff). */

export const GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER = "growth-engagement-dashboard-s4a-v1" as const

export const GROWTH_ENGAGEMENT_DASHBOARD_DATE_RANGE_PRESETS = [
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "custom",
] as const

export type GrowthEngagementDashboardDateRangePreset =
  (typeof GROWTH_ENGAGEMENT_DASHBOARD_DATE_RANGE_PRESETS)[number]

export const GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE: GrowthEngagementDashboardDateRangePreset =
  "last_30_days"

export type GrowthEngagementDashboardSafetyFlags = {
  read_only: true
  no_db_mutations: true
  no_notifications: true
  no_sequence_execution: true
  no_provider_execution: true
}

export const GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS: GrowthEngagementDashboardSafetyFlags = {
  read_only: true,
  no_db_mutations: true,
  no_notifications: true,
  no_sequence_execution: true,
  no_provider_execution: true,
}

export type GrowthEngagementDashboardFilters = {
  organizationId: string
  dateRange: GrowthEngagementDashboardDateRangePreset
  startDate?: string | null
  endDate?: string | null
  templateId?: string | null
  mediaAssetId?: string | null
  leadId?: string | null
}

export type GrowthEngagementDashboardResolvedDateRange = {
  preset: GrowthEngagementDashboardDateRangePreset
  startIso: string
  endIso: string
}

export type GrowthEngagementDashboardSourceKey =
  | "share_pages"
  | "share_page_analytics"
  | "media_assets"
  | "media_asset_events"
  | "media_asset_event_rollups"
  | "share_page_templates"
  | "booking_handoff_foundation"
  | "high_intent_signals"

export type GrowthEngagementDashboardSourceAvailability = Record<
  GrowthEngagementDashboardSourceKey,
  {
    source_available: boolean
    message?: string | null
  }
>

export type GrowthEngagementDashboardOverviewMetrics = {
  totalSharePageViews: number
  uniqueSharePageVisitors: number
  ctaClicks: number
  bookingStarts: number
  bookingCompletions: number
  mediaViews: number
  mediaPlayStarts: number
  mediaCompletions: number
  mediaCtaClicks: number
  averageWatchSeconds: number
  completionRate: number
  templateUsageCount: number
}

export type GrowthEngagementDashboardTemplatePerformanceRow = {
  templateId: string
  templateName: string
  usageCount: number
  sharePageViews: number
  ctaClicks: number
  bookingStarts: number
  bookingCompletions: number
  lastActivityAt: string | null
}

export type GrowthEngagementDashboardMediaPerformanceRow = {
  assetId: string
  assetLabel: string
  views: number
  uniqueViews: number
  playStarts: number
  completions: number
  ctaClicks: number
  averageWatchSeconds: number
  completionRate: number
  lastEventAt: string | null
}

export type GrowthEngagementDashboardCtaPerformance = {
  sharePageCtaClicks: number
  mediaCtaClicks: number
  totalCtaClicks: number
  topCtaKeys: Array<{ key: string; count: number }>
}

export type GrowthEngagementDashboardBookingHandoffReadiness = {
  templatesWithHandoffEnabled: number
  sharePageBookingStarts: number
  sharePageBookingCompletions: number
  foundationHandoffRecords: number
  readyTierCount: number
  highIntentTierCount: number
  sourceAvailable: boolean
}

export type GrowthEngagementDashboardHighIntentSignal = {
  id: string
  signalType: string
  companyName: string
  leadId: string | null
  sharePageId: string | null
  assetId: string | null
  occurredAt: string
  score: number | null
  excerpt: string | null
  source: "signal" | "share_page_event" | "media_event"
}

export type SharePageEngagementSnapshot = {
  sharePageIds: string[]
  views: Array<{ id: string; share_page_id: string; session_key: string; started_at: string }>
  events: Array<{
    share_page_id: string
    event_type: string
    occurred_at: string
    metadata: Record<string, unknown>
  }>
  totalSharePageViews: number
  uniqueSharePageVisitors: number
  ctaClicks: number
  bookingStarts: number
  bookingCompletions: number
  templateUsageCount: number
}

export type GrowthEngagementDashboardOverviewResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER
  filters: GrowthEngagementDashboardFilters
  dateRange: GrowthEngagementDashboardResolvedDateRange
  overview: GrowthEngagementDashboardOverviewMetrics
  topTemplates: GrowthEngagementDashboardTemplatePerformanceRow[]
  topAssets: GrowthEngagementDashboardMediaPerformanceRow[]
  ctaPerformance: GrowthEngagementDashboardCtaPerformance
  bookingHandoffReadiness: GrowthEngagementDashboardBookingHandoffReadiness
  sourceAvailability: GrowthEngagementDashboardSourceAvailability
} & GrowthEngagementDashboardSafetyFlags

export type GrowthEngagementDashboardTemplatesResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER
  filters: GrowthEngagementDashboardFilters
  dateRange: GrowthEngagementDashboardResolvedDateRange
  items: GrowthEngagementDashboardTemplatePerformanceRow[]
  total: number
  sourceAvailability: Pick<
    GrowthEngagementDashboardSourceAvailability,
    "share_pages" | "share_page_analytics" | "share_page_templates"
  >
} & GrowthEngagementDashboardSafetyFlags

export type GrowthEngagementDashboardMediaResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER
  filters: GrowthEngagementDashboardFilters
  dateRange: GrowthEngagementDashboardResolvedDateRange
  items: GrowthEngagementDashboardMediaPerformanceRow[]
  totals: {
    views: number
    uniqueViews: number
    playStarts: number
    completions: number
    ctaClicks: number
    averageWatchSeconds: number
    completionRate: number
  }
  sourceAvailability: Pick<
    GrowthEngagementDashboardSourceAvailability,
    "media_assets" | "media_asset_events" | "media_asset_event_rollups"
  >
} & GrowthEngagementDashboardSafetyFlags

export type GrowthEngagementDashboardHighIntentResponse = {
  qa_marker: typeof GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER
  filters: GrowthEngagementDashboardFilters
  dateRange: GrowthEngagementDashboardResolvedDateRange
  items: GrowthEngagementDashboardHighIntentSignal[]
  total: number
  sourceAvailability: Pick<GrowthEngagementDashboardSourceAvailability, "high_intent_signals" | "share_page_analytics">
} & GrowthEngagementDashboardSafetyFlags
