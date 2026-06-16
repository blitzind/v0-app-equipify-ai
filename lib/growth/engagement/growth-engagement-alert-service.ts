import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getGrowthEngagementDashboardHighIntent,
  getGrowthEngagementDashboardOverview,
  getGrowthEngagementDashboardTemplates,
} from "@/lib/growth/engagement/growth-engagement-dashboard-service"
import { probeGrowthEngagementDashboardSourceAvailability } from "@/lib/growth/engagement/growth-engagement-dashboard-repository"
import { resolveEngagementDashboardDateRange } from "@/lib/growth/engagement/growth-engagement-dashboard-utils"
import { fetchEngagementTimelineEvents } from "@/lib/growth/engagement/growth-engagement-timeline-repository"
import {
  filterEngagementTimelineEvents,
  parseEngagementTimelineFilters,
} from "@/lib/growth/engagement/growth-engagement-timeline-utils"
import type { GrowthEngagementTimelineEvent } from "@/lib/growth/engagement/growth-engagement-timeline-types"
import {
  GROWTH_ENGAGEMENT_ALERT_QA_MARKER,
  type GrowthEngagementAlert,
  type GrowthEngagementAlertDetailResponse,
  type GrowthEngagementAlertFilters,
  type GrowthEngagementAlertSource,
  type GrowthEngagementAlertType,
  type GrowthEngagementAlertsListResponse,
} from "@/lib/growth/engagement/growth-engagement-alert-types"
import {
  GROWTH_ENGAGEMENT_ALERT_MAX_LIMIT,
  GROWTH_ENGAGEMENT_PREDEFINED_WATCHLISTS,
  GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS,
  alertMatchesWatchlist,
  buildEngagementAlertId,
  filterEngagementAlerts,
  limitEngagementAlerts,
  parseEngagementAlertFilters,
  resolveEngagementAlertSeverity,
} from "@/lib/growth/engagement/growth-engagement-watchlist-utils"

const TIMELINE_ALERT_MAP: Partial<Record<GrowthEngagementTimelineEvent["eventType"], GrowthEngagementAlertType>> = {
  high_intent_detected: "high_intent_detected",
  booking_handoff_ready: "meeting_ready",
  media_completed: "video_completed",
  media_cta_clicked: "video_cta_clicked",
  share_page_booking_started: "booking_started",
  share_page_booking_completed: "booking_completed",
}

function resolveEntityFromEvent(event: GrowthEngagementTimelineEvent): {
  entityType: GrowthEngagementAlert["entityType"]
  entityId: string
} | null {
  if (event.leadId) return { entityType: "lead", entityId: event.leadId }
  if (event.templateId) return { entityType: "template", entityId: event.templateId }
  if (event.mediaAssetId) return { entityType: "media", entityId: event.mediaAssetId }
  if (event.sharePageId) return { entityType: "share_page", entityId: event.sharePageId }
  return null
}

function buildTimelineAlert(
  event: GrowthEngagementTimelineEvent,
  alertType: GrowthEngagementAlertType,
  watchlistId: string | null,
): GrowthEngagementAlert | null {
  const entity = resolveEntityFromEvent(event)
  if (!entity) return null

  const metadata: Record<string, unknown> = {
    ...event.metadata,
    leadId: event.leadId,
    templateId: event.templateId,
    mediaAssetId: event.mediaAssetId,
    sharePageId: event.sharePageId,
    eventType: event.eventType,
    watchSeconds: event.metadata.watchSeconds ?? event.metadata.watch_seconds ?? null,
  }

  return {
    alertId: buildEngagementAlertId(alertType, entity.entityType, entity.entityId, event.occurredAt),
    watchlistId,
    alertType,
    title: event.title,
    description: event.description,
    severity: resolveEngagementAlertSeverity(alertType, metadata),
    entityType: entity.entityType,
    entityId: entity.entityId,
    occurredAt: event.occurredAt,
    metadata,
    source: "timeline_event",
    acknowledged: false,
  }
}

function buildHighIntentAlerts(
  signals: Awaited<ReturnType<typeof getGrowthEngagementDashboardHighIntent>>,
  minimumScore: number,
): GrowthEngagementAlert[] {
  return signals.items
    .filter((signal) => (signal.score ?? 0) >= minimumScore)
    .map((signal) => {
      const alertType: GrowthEngagementAlertType =
        (signal.score ?? 0) >= minimumScore + 10 ? "high_intent_detected" : "high_engagement_score"
      const entityType = signal.leadId ? "lead" : signal.sharePageId ? "share_page" : "lead"
      const entityId = signal.leadId ?? signal.sharePageId ?? signal.id
      const metadata = {
        score: signal.score,
        signalType: signal.signalType,
        companyName: signal.companyName,
        leadId: signal.leadId,
        sharePageId: signal.sharePageId,
        assetId: signal.assetId,
      }

      return {
        alertId: buildEngagementAlertId(alertType, entityType, entityId, signal.occurredAt),
        watchlistId: null,
        alertType,
        title: `High-intent: ${signal.companyName}`,
        description: signal.excerpt ?? signal.signalType,
        severity: resolveEngagementAlertSeverity(alertType, metadata),
        entityType,
        entityId,
        occurredAt: signal.occurredAt,
        metadata,
        source: "high_intent_signal" as GrowthEngagementAlertSource,
        acknowledged: false as const,
      }
    })
}

function buildRepeatViewerAlerts(events: GrowthEngagementTimelineEvent[]): GrowthEngagementAlert[] {
  const viewCounts = new Map<string, { leadId: string; sharePageId: string | null; sessions: Set<string>; count: number; lastAt: string }>()

  for (const event of events) {
    if (event.eventType !== "share_page_viewed" || !event.leadId) continue
    const key = `${event.leadId}:${event.sharePageId ?? "any"}`
    const current = viewCounts.get(key) ?? {
      leadId: event.leadId,
      sharePageId: event.sharePageId,
      sessions: new Set<string>(),
      count: 0,
      lastAt: event.occurredAt,
    }
    current.count += 1
    if (event.sessionId) current.sessions.add(event.sessionId)
    if (event.occurredAt > current.lastAt) current.lastAt = event.occurredAt
    viewCounts.set(key, current)
  }

  const alerts: GrowthEngagementAlert[] = []

  for (const entry of viewCounts.values()) {
    if (entry.sessions.size >= 2) {
      alerts.push({
        alertId: buildEngagementAlertId("multi_session_activity", "lead", entry.leadId, entry.lastAt),
        watchlistId: null,
        alertType: "multi_session_activity",
        title: "Multi-session activity detected",
        description: `Lead viewed share pages across ${entry.sessions.size} sessions.`,
        severity: resolveEngagementAlertSeverity("multi_session_activity"),
        entityType: "lead",
        entityId: entry.leadId,
        occurredAt: entry.lastAt,
        metadata: {
          leadId: entry.leadId,
          sharePageId: entry.sharePageId,
          sessionCount: entry.sessions.size,
          viewCount: entry.count,
        },
        source: "timeline_event",
        acknowledged: false,
      })
    }

    if (entry.count >= 2) {
      alerts.push({
        alertId: buildEngagementAlertId("repeat_viewer", "lead", entry.leadId, entry.lastAt),
        watchlistId: null,
        alertType: "repeat_viewer",
        title: "Repeat viewer detected",
        description: `Lead viewed the same share page ${entry.count} times.`,
        severity: resolveEngagementAlertSeverity("repeat_viewer"),
        entityType: "lead",
        entityId: entry.leadId,
        occurredAt: entry.lastAt,
        metadata: {
          leadId: entry.leadId,
          sharePageId: entry.sharePageId,
          viewCount: entry.count,
        },
        source: "timeline_event",
        acknowledged: false,
      })
    }
  }

  return alerts
}

function buildTemplateSpikeAlerts(
  templates: Awaited<ReturnType<typeof getGrowthEngagementDashboardTemplates>>,
): GrowthEngagementAlert[] {
  if (templates.items.length === 0) return []

  const averageViews =
    templates.items.reduce((sum, item) => sum + item.sharePageViews, 0) / Math.max(templates.items.length, 1)
  const spikeThreshold = Math.max(averageViews * 1.5, 5)

  return templates.items
    .filter((item) => item.sharePageViews >= spikeThreshold || item.ctaClicks >= 3)
    .map((item) => {
      const metadata = {
        templateId: item.templateId,
        templateName: item.templateName,
        sharePageViews: item.sharePageViews,
        ctaClicks: item.ctaClicks,
        spikeThreshold,
      }

      return {
        alertId: buildEngagementAlertId(
          "template_performance_spike",
          "template",
          item.templateId,
          item.lastActivityAt ?? new Date().toISOString(),
        ),
        watchlistId: null,
        alertType: "template_performance_spike" as const,
        title: `Template spike: ${item.templateName}`,
        description: `${item.sharePageViews} views and ${item.ctaClicks} CTA clicks in range.`,
        severity: resolveEngagementAlertSeverity("template_performance_spike", metadata),
        entityType: "template" as const,
        entityId: item.templateId,
        occurredAt: item.lastActivityAt ?? new Date().toISOString(),
        metadata,
        source: "template_performance" as GrowthEngagementAlertSource,
        acknowledged: false as const,
      }
    })
}

function attachWatchlists(alerts: GrowthEngagementAlert[]): GrowthEngagementAlert[] {
  return alerts.map((alert) => {
    const watchlist = GROWTH_ENGAGEMENT_PREDEFINED_WATCHLISTS.find((entry) => alertMatchesWatchlist(alert, entry))
    return watchlist ? { ...alert, watchlistId: watchlist.watchlistId } : alert
  })
}

function dedupeAlerts(alerts: GrowthEngagementAlert[]): GrowthEngagementAlert[] {
  const seen = new Set<string>()
  const deduped: GrowthEngagementAlert[] = []
  for (const alert of alerts.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))) {
    if (seen.has(alert.alertId)) continue
    seen.add(alert.alertId)
    deduped.push(alert)
  }
  return deduped
}

async function buildEngagementAlerts(
  admin: SupabaseClient,
  filters: GrowthEngagementAlertFilters,
): Promise<GrowthEngagementAlert[]> {
  const dashboardFilters = {
    organizationId: filters.organizationId,
    dateRange: filters.dateRange,
    startDate: filters.startDate,
    endDate: filters.endDate,
    leadId: filters.leadId,
    templateId: filters.templateId,
    mediaAssetId: filters.mediaAssetId,
  }

  const timelineFilters = parseEngagementTimelineFilters(filters.organizationId, new URLSearchParams())
  timelineFilters.dateRange = filters.dateRange
  timelineFilters.startDate = filters.startDate
  timelineFilters.endDate = filters.endDate
  timelineFilters.leadId = filters.leadId
  timelineFilters.templateId = filters.templateId
  timelineFilters.mediaAssetId = filters.mediaAssetId
  timelineFilters.sharePageId = filters.sharePageId
  timelineFilters.limit = GROWTH_ENGAGEMENT_ALERT_MAX_LIMIT

  const [timelineLoaded, highIntent, templates, overview] = await Promise.all([
    fetchEngagementTimelineEvents(admin, timelineFilters),
    getGrowthEngagementDashboardHighIntent(admin, dashboardFilters),
    getGrowthEngagementDashboardTemplates(admin, dashboardFilters),
    getGrowthEngagementDashboardOverview(admin, dashboardFilters),
  ])

  const events = filterEngagementTimelineEvents(timelineLoaded.events, timelineFilters)
  const minimumScore = 70

  const timelineAlerts = events.flatMap((event) => {
    const alertType = TIMELINE_ALERT_MAP[event.eventType]
    if (!alertType) return []
    const alert = buildTimelineAlert(event, alertType, null)
    if (!alert) return []

    if (alertType === "video_completed" || alertType === "video_cta_clicked") {
      const watchSeconds = Number(alert.metadata.watchSeconds ?? 0)
      const mediaRow = overview.topAssets.find((asset) => asset.assetId === event.mediaAssetId)
      const averageWatchSeconds = mediaRow?.averageWatchSeconds ?? watchSeconds
      alert.metadata.averageWatchSeconds = averageWatchSeconds
      if (averageWatchSeconds < 30 && watchSeconds < 30) return []
    }

    return [alert]
  })

  const alerts = dedupeAlerts([
    ...timelineAlerts,
    ...buildHighIntentAlerts(highIntent, minimumScore),
    ...buildRepeatViewerAlerts(events),
    ...buildTemplateSpikeAlerts(templates),
  ])

  if (overview.bookingHandoffReadiness.highIntentTierCount > 0) {
    alerts.push({
      alertId: buildEngagementAlertId(
        "meeting_ready",
        "share_page",
        "booking-handoff-readiness",
        overview.dateRange.endIso,
      ),
      watchlistId: null,
      alertType: "meeting_ready",
      title: "Booking handoff readiness elevated",
      description: `${overview.bookingHandoffReadiness.highIntentTierCount} high-intent tier records in range.`,
      severity: "critical",
      entityType: "share_page",
      entityId: "booking-handoff-readiness",
      occurredAt: overview.dateRange.endIso,
      metadata: {
        highIntentTierCount: overview.bookingHandoffReadiness.highIntentTierCount,
        readyTierCount: overview.bookingHandoffReadiness.readyTierCount,
      },
      source: "booking_handoff_readiness",
      acknowledged: false,
    })
  }

  return attachWatchlists(alerts)
}

export async function listGrowthEngagementAlerts(
  admin: SupabaseClient,
  filters: GrowthEngagementAlertFilters,
): Promise<GrowthEngagementAlertsListResponse> {
  const [sourceAvailability, alerts] = await Promise.all([
    probeGrowthEngagementDashboardSourceAvailability(admin),
    buildEngagementAlerts(admin, filters),
  ])

  const filtered = filterEngagementAlerts(alerts, filters)
  const limited = limitEngagementAlerts(filtered, filters.limit)
  const dateRange = resolveEngagementDashboardDateRange(filters)

  return {
    qa_marker: GROWTH_ENGAGEMENT_ALERT_QA_MARKER,
    filters,
    dateRange,
    alerts: limited,
    total: filtered.length,
    safety: GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS,
    sourceAvailability,
  }
}

export async function getGrowthEngagementAlert(
  admin: SupabaseClient,
  alertId: string,
  filters: GrowthEngagementAlertFilters,
): Promise<GrowthEngagementAlertDetailResponse | null> {
  const [sourceAvailability, alerts] = await Promise.all([
    probeGrowthEngagementDashboardSourceAvailability(admin),
    buildEngagementAlerts(admin, { ...filters, limit: GROWTH_ENGAGEMENT_ALERT_MAX_LIMIT }),
  ])

  const match = alerts.find((entry) => entry.alertId === alertId)
  if (!match) return null

  return {
    qa_marker: GROWTH_ENGAGEMENT_ALERT_QA_MARKER,
    alert: match,
    safety: GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS,
    sourceAvailability,
  }
}

export { parseEngagementAlertFilters }
