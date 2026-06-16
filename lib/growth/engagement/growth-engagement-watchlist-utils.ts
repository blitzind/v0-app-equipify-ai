import { z } from "zod"
import {
  GROWTH_ENGAGEMENT_ALERT_SEVERITIES,
  GROWTH_ENGAGEMENT_ALERT_TYPES,
  type GrowthEngagementAlert,
  type GrowthEngagementAlertFilters,
  type GrowthEngagementAlertSeverity,
  type GrowthEngagementAlertType,
} from "@/lib/growth/engagement/growth-engagement-alert-types"
import {
  GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE,
  type GrowthEngagementDashboardDateRangePreset,
} from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import { parseEngagementDashboardFilters } from "@/lib/growth/engagement/growth-engagement-dashboard-utils"
import {
  GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER,
  GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS,
  type GrowthEngagementWatchlist,
  type GrowthEngagementWatchlistRules,
} from "@/lib/growth/engagement/growth-engagement-watchlist-types"

export const GROWTH_ENGAGEMENT_ALERT_DEFAULT_LIMIT = 100 as const
export const GROWTH_ENGAGEMENT_ALERT_MAX_LIMIT = 500 as const

const DATE_RANGE_SCHEMA = z.enum(["last_7_days", "last_30_days", "last_90_days", "custom"])
const ALERT_TYPE_SCHEMA = z.enum(GROWTH_ENGAGEMENT_ALERT_TYPES)
const SEVERITY_SCHEMA = z.enum(GROWTH_ENGAGEMENT_ALERT_SEVERITIES)

const WATCHLIST_BASE_TIMESTAMP = "2026-06-16T00:00:00.000Z"

function buildPredefinedWatchlist(input: {
  watchlistId: string
  name: string
  description: string
  rules: GrowthEngagementWatchlistRules
}): GrowthEngagementWatchlist {
  return {
    watchlistId: input.watchlistId,
    name: input.name,
    description: input.description,
    enabled: true,
    filters: {},
    rules: input.rules,
    createdAt: WATCHLIST_BASE_TIMESTAMP,
    updatedAt: WATCHLIST_BASE_TIMESTAMP,
    safety: GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS,
  }
}

export const GROWTH_ENGAGEMENT_PREDEFINED_WATCHLISTS: GrowthEngagementWatchlist[] = [
  buildPredefinedWatchlist({
    watchlistId: "wl-high-intent-prospects",
    name: "High Intent Prospects",
    description: "Meeting-ready signals, completed bookings, and high-intent detections.",
    rules: {
      alertTypes: ["meeting_ready", "booking_completed", "high_intent_detected"],
    },
  }),
  buildPredefinedWatchlist({
    watchlistId: "wl-engaged-video-viewers",
    name: "Engaged Video Viewers",
    description: "Video completions and CTA clicks with meaningful watch time.",
    rules: {
      alertTypes: ["video_completed", "video_cta_clicked"],
      minimumWatchSeconds: 30,
    },
  }),
  buildPredefinedWatchlist({
    watchlistId: "wl-multi-session-activity",
    name: "Multi-Session Activity",
    description: "Repeat viewers and leads engaging across multiple sessions.",
    rules: {
      alertTypes: ["repeat_viewer", "multi_session_activity"],
    },
  }),
  buildPredefinedWatchlist({
    watchlistId: "wl-template-performance-spikes",
    name: "Template Performance Spikes",
    description: "Templates with unusually strong engagement in the selected range.",
    rules: {
      alertTypes: ["template_performance_spike"],
    },
  }),
]

export function clampEngagementAlertLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return GROWTH_ENGAGEMENT_ALERT_DEFAULT_LIMIT
  return Math.min(Math.max(Math.floor(value ?? GROWTH_ENGAGEMENT_ALERT_DEFAULT_LIMIT), 1), GROWTH_ENGAGEMENT_ALERT_MAX_LIMIT)
}

export function parseEngagementAlertType(raw: string | null | undefined): GrowthEngagementAlertType | null {
  if (!raw?.trim()) return null
  const parsed = ALERT_TYPE_SCHEMA.safeParse(raw.trim())
  return parsed.success ? parsed.data : null
}

export function parseEngagementAlertSeverity(raw: string | null | undefined): GrowthEngagementAlertSeverity | null {
  if (!raw?.trim()) return null
  const parsed = SEVERITY_SCHEMA.safeParse(raw.trim())
  return parsed.success ? parsed.data : null
}

export function parseEngagementAlertFilters(
  organizationId: string,
  searchParams: URLSearchParams,
): GrowthEngagementAlertFilters {
  const dashboardFilters = parseEngagementDashboardFilters(organizationId, searchParams)
  const dateRangeRaw = searchParams.get("dateRange") ?? searchParams.get("date_range")
  const parsedDateRange = dateRangeRaw ? DATE_RANGE_SCHEMA.safeParse(dateRangeRaw) : null
  const dateRange: GrowthEngagementDashboardDateRangePreset = parsedDateRange?.success
    ? parsedDateRange.data
    : dashboardFilters.dateRange ?? GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE

  const alertTypeRaw = searchParams.get("alertType") ?? searchParams.get("alert_type")
  const severityRaw = searchParams.get("severity")

  const limitRaw = searchParams.get("limit")
  const limit = limitRaw ? clampEngagementAlertLimit(Number(limitRaw)) : GROWTH_ENGAGEMENT_ALERT_DEFAULT_LIMIT

  return {
    organizationId,
    dateRange,
    startDate: dashboardFilters.startDate,
    endDate: dashboardFilters.endDate,
    severity: parseEngagementAlertSeverity(severityRaw),
    alertType: parseEngagementAlertType(alertTypeRaw),
    leadId: searchParams.get("leadId") ?? searchParams.get("lead_id") ?? dashboardFilters.leadId,
    templateId: searchParams.get("templateId") ?? searchParams.get("template_id") ?? dashboardFilters.templateId,
    mediaAssetId:
      searchParams.get("mediaAssetId") ??
      searchParams.get("media_asset_id") ??
      searchParams.get("assetId") ??
      dashboardFilters.mediaAssetId,
    sharePageId: searchParams.get("sharePageId") ?? searchParams.get("share_page_id"),
    watchlistId: searchParams.get("watchlistId") ?? searchParams.get("watchlist_id"),
    limit,
  }
}

export function findEngagementWatchlist(watchlistId: string): GrowthEngagementWatchlist | null {
  return GROWTH_ENGAGEMENT_PREDEFINED_WATCHLISTS.find((watchlist) => watchlist.watchlistId === watchlistId) ?? null
}

export function resolveEngagementAlertSeverity(
  alertType: GrowthEngagementAlertType,
  metadata: Record<string, unknown> = {},
): GrowthEngagementAlertSeverity {
  if (alertType === "booking_completed") return "critical"
  if (alertType === "meeting_ready") return "critical"
  if (alertType === "high_intent_detected") return "high"
  if (alertType === "booking_started") return "high"
  if (alertType === "template_performance_spike") return "high"
  if (alertType === "high_engagement_score") {
    const score = Number(metadata.score ?? 0)
    return score >= 85 ? "high" : "medium"
  }
  if (alertType === "video_completed" || alertType === "video_cta_clicked") return "medium"
  return "low"
}

export function buildEngagementAlertId(
  alertType: GrowthEngagementAlertType,
  entityType: GrowthEngagementAlert["entityType"],
  entityId: string,
  occurredAt: string,
): string {
  return `${alertType}:${entityType}:${entityId}:${occurredAt}`
}

export function alertMatchesWatchlist(alert: GrowthEngagementAlert, watchlist: GrowthEngagementWatchlist): boolean {
  if (!watchlist.enabled) return false
  if (!watchlist.rules.alertTypes.includes(alert.alertType)) return false

  if (watchlist.rules.minimumEngagementScore != null) {
    const score = Number(alert.metadata.score ?? 0)
    if (score < watchlist.rules.minimumEngagementScore) return false
  }

  if (watchlist.rules.minimumWatchSeconds != null) {
    const watchSeconds = Number(alert.metadata.watchSeconds ?? alert.metadata.averageWatchSeconds ?? 0)
    if (watchSeconds < watchlist.rules.minimumWatchSeconds) return false
  }

  if (watchlist.filters.leadId && alert.entityType === "lead" && alert.entityId !== watchlist.filters.leadId) {
    return false
  }

  return true
}

export function filterEngagementAlerts(alerts: GrowthEngagementAlert[], filters: GrowthEngagementAlertFilters): GrowthEngagementAlert[] {
  const watchlist = filters.watchlistId ? findEngagementWatchlist(filters.watchlistId) : null

  return alerts.filter((alert) => {
    if (filters.severity && alert.severity !== filters.severity) return false
    if (filters.alertType && alert.alertType !== filters.alertType) return false
    if (filters.leadId) {
      const leadMatch =
        (alert.entityType === "lead" && alert.entityId === filters.leadId) ||
        alert.metadata.leadId === filters.leadId
      if (!leadMatch) return false
    }
    if (filters.templateId) {
      const templateMatch =
        (alert.entityType === "template" && alert.entityId === filters.templateId) ||
        alert.metadata.templateId === filters.templateId
      if (!templateMatch) return false
    }
    if (filters.mediaAssetId) {
      const mediaMatch =
        (alert.entityType === "media" && alert.entityId === filters.mediaAssetId) ||
        alert.metadata.mediaAssetId === filters.mediaAssetId ||
        alert.metadata.assetId === filters.mediaAssetId
      if (!mediaMatch) return false
    }
    if (filters.sharePageId) {
      const sharePageMatch =
        (alert.entityType === "share_page" && alert.entityId === filters.sharePageId) ||
        alert.metadata.sharePageId === filters.sharePageId
      if (!sharePageMatch) return false
    }
    if (watchlist && !alertMatchesWatchlist(alert, watchlist)) return false
    return true
  })
}

export function limitEngagementAlerts(alerts: GrowthEngagementAlert[], limit: number | undefined): GrowthEngagementAlert[] {
  return alerts.slice(0, clampEngagementAlertLimit(limit))
}

export { GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER, GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS }
