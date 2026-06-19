import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_VIDEO_ANALYTICS_QA_MARKER,
  type GrowthVideoAnalyticsDistributionBucket,
  type GrowthVideoAnalyticsOverview,
  type GrowthVideoAnalyticsTimeSeriesPoint,
  type GrowthVideoAnalyticsTopItem,
  type GrowthVideoEngagementSummary,
} from "@/lib/growth/videos/growth-video-types"
import {
  computeGrowthVideoEngagementScore,
  rollupGrowthVideoPageEventsBySession,
} from "@/lib/growth/videos/growth-video-engagement-scoring-service"
import {
  isGrowthVideoAnalyticsSchemaReady,
  isGrowthVideoPageEventsSchemaReady,
} from "@/lib/growth/videos/growth-video-schema-health"

const SUMMARY_SELECT =
  "id, organization_id, video_asset_id, video_page_id, visitor_identifier, session_id, total_views, total_watch_seconds, highest_percent_watched, total_cta_clicks, total_calendar_clicks, first_viewed_at, last_viewed_at, engagement_score, metadata_json, created_at, updated_at"

const EVENT_SELECT =
  "organization_id, video_asset_id, video_page_id, visitor_identifier, session_id, event_type, metadata_json, created_at"

type SummaryRow = {
  id: string
  organization_id: string
  video_asset_id: string
  video_page_id: string
  visitor_identifier: string | null
  session_id: string
  total_views: number
  total_watch_seconds: number
  highest_percent_watched: number
  total_cta_clicks: number
  total_calendar_clicks: number
  first_viewed_at: string | null
  last_viewed_at: string | null
  engagement_score: number
  metadata_json: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

function mapSummaryRow(row: SummaryRow): GrowthVideoEngagementSummary {
  return {
    id: row.id,
    organizationId: row.organization_id,
    videoAssetId: row.video_asset_id,
    videoPageId: row.video_page_id,
    visitorIdentifier: row.visitor_identifier,
    sessionId: row.session_id,
    totalViews: row.total_views,
    totalWatchSeconds: row.total_watch_seconds,
    highestPercentWatched: Number(row.highest_percent_watched),
    totalCtaClicks: row.total_cta_clicks,
    totalCalendarClicks: row.total_calendar_clicks,
    firstViewedAt: row.first_viewed_at,
    lastViewedAt: row.last_viewed_at,
    engagementScore: row.engagement_score,
    metadata: row.metadata_json ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function countVisitorSessions(
  rollups: ReturnType<typeof rollupGrowthVideoPageEventsBySession>,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const rollup of rollups) {
    const visitorKey = rollup.visitorIdentifier?.trim() || rollup.sessionId
    counts.set(visitorKey, (counts.get(visitorKey) ?? 0) + 1)
  }
  return counts
}

export type GrowthVideoAnalyticsFilters = {
  organizationId: string
  videoAssetId?: string | null
  videoPageId?: string | null
  visitorIdentifier?: string | null
  since?: string | null
  until?: string | null
}

export class GrowthVideoAnalyticsSummaryService {
  constructor(private readonly admin: SupabaseClient) {}

  async rebuildSummariesFromEvents(filters: GrowthVideoAnalyticsFilters): Promise<{
    ok: true
    rebuilt: number
  } | { ok: false; error: string }> {
    if (!(await isGrowthVideoPageEventsSchemaReady(this.admin))) {
      return { ok: false, error: "page_events_schema_not_ready" }
    }
    if (!(await isGrowthVideoAnalyticsSchemaReady(this.admin))) {
      return { ok: false, error: "analytics_schema_not_ready" }
    }

    let query = this.admin
      .schema("growth")
      .from("video_page_events")
      .select(EVENT_SELECT)
      .eq("organization_id", filters.organizationId)
      .order("created_at", { ascending: true })
      .limit(5000)

    if (filters.videoAssetId) query = query.eq("video_asset_id", filters.videoAssetId)
    if (filters.videoPageId) query = query.eq("video_page_id", filters.videoPageId)
    if (filters.visitorIdentifier) {
      query = query.eq("visitor_identifier", filters.visitorIdentifier)
    }
    if (filters.since) query = query.gte("created_at", filters.since)
    if (filters.until) query = query.lte("created_at", filters.until)

    const { data, error } = await query
    if (error) return { ok: false, error: error.message }

    const rollups = rollupGrowthVideoPageEventsBySession(
      (data as Array<Record<string, unknown>>).map((row) => ({
        organization_id: String(row.organization_id),
        video_asset_id: String(row.video_asset_id),
        video_page_id: String(row.video_page_id),
        visitor_identifier: (row.visitor_identifier as string | null) ?? null,
        session_id: (row.session_id as string | null) ?? null,
        event_type: String(row.event_type),
        metadata_json: (row.metadata_json as Record<string, unknown> | null) ?? null,
        created_at: String(row.created_at),
      })),
    )

    const visitorSessions = countVisitorSessions(rollups)
    let rebuilt = 0

    for (const rollup of rollups) {
      const visitorKey = rollup.visitorIdentifier?.trim() || rollup.sessionId
      const visitorSessionCount = visitorSessions.get(visitorKey) ?? 1
      const scoreResult = computeGrowthVideoEngagementScore({ rollup, visitorSessionCount })

      const row = {
        organization_id: rollup.organizationId,
        video_asset_id: rollup.videoAssetId,
        video_page_id: rollup.videoPageId,
        visitor_identifier: rollup.visitorIdentifier,
        session_id: rollup.sessionId,
        total_views: rollup.totalViews,
        total_watch_seconds: rollup.totalWatchSeconds,
        highest_percent_watched: rollup.highestPercentWatched,
        total_cta_clicks: rollup.totalCtaClicks,
        total_calendar_clicks: rollup.totalCalendarClicks,
        first_viewed_at: rollup.firstViewedAt,
        last_viewed_at: rollup.lastViewedAt,
        engagement_score: scoreResult.engagementScore,
        metadata_json: {
          ai_signals: scoreResult.aiSignals,
          ai_engagement_summary: scoreResult.aiEngagementSummary,
          visit_confidence_bonus: scoreResult.visitConfidenceBonus,
          qa_marker: GROWTH_VIDEO_ANALYTICS_QA_MARKER,
        },
        qa_marker: GROWTH_VIDEO_ANALYTICS_QA_MARKER,
      }

      const { error: upsertError } = await this.admin
        .schema("growth")
        .from("video_engagement_summaries")
        .upsert(row, { onConflict: "organization_id,video_page_id,session_id" })

      if (upsertError) return { ok: false, error: upsertError.message }
      rebuilt += 1
    }

    return { ok: true, rebuilt }
  }

  async listSummaries(filters: GrowthVideoAnalyticsFilters): Promise<GrowthVideoEngagementSummary[]> {
    await this.rebuildSummariesFromEvents(filters)

    let query = this.admin
      .schema("growth")
      .from("video_engagement_summaries")
      .select(SUMMARY_SELECT)
      .eq("organization_id", filters.organizationId)
      .order("updated_at", { ascending: false })
      .limit(500)

    if (filters.videoAssetId) query = query.eq("video_asset_id", filters.videoAssetId)
    if (filters.videoPageId) query = query.eq("video_page_id", filters.videoPageId)
    if (filters.visitorIdentifier) query = query.eq("visitor_identifier", filters.visitorIdentifier)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data as SummaryRow[]).map(mapSummaryRow)
  }

  async buildOverview(filters: GrowthVideoAnalyticsFilters): Promise<GrowthVideoAnalyticsOverview> {
    const summaries = await this.listSummaries(filters)
    const totalViews = summaries.reduce((sum, row) => sum + row.totalViews, 0)
    const uniqueVisitors = new Set(
      summaries.map((row) => row.visitorIdentifier?.trim() || row.sessionId),
    ).size
    const ctaClicks = summaries.reduce((sum, row) => sum + row.totalCtaClicks, 0)
    const calendarClicks = summaries.reduce((sum, row) => sum + row.totalCalendarClicks, 0)
    const watchPercents = summaries
      .map((row) => row.highestPercentWatched)
      .filter((value) => value > 0)
    const averageWatchPercent =
      watchPercents.length > 0
        ? Math.round(watchPercents.reduce((a, b) => a + b, 0) / watchPercents.length)
        : null
    const scores = summaries.map((row) => row.engagementScore).filter((value) => value > 0)
    const averageEngagementScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

    return {
      totalViews,
      uniqueVisitors,
      averageWatchPercent,
      ctaClicks,
      calendarClicks,
      meetingsBooked: null,
      averageEngagementScore,
    }
  }

  async buildViewsOverTime(filters: GrowthVideoAnalyticsFilters): Promise<GrowthVideoAnalyticsTimeSeriesPoint[]> {
    const summaries = await this.listSummaries(filters)
    const buckets = new Map<string, { views: number; sessions: Set<string> }>()

    for (const summary of summaries) {
      const date = (summary.firstViewedAt ?? summary.createdAt).slice(0, 10)
      const bucket = buckets.get(date) ?? { views: 0, sessions: new Set<string>() }
      bucket.views += summary.totalViews
      bucket.sessions.add(summary.sessionId)
      buckets.set(date, bucket)
    }

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, bucket]) => ({
        date,
        views: bucket.views,
        uniqueSessions: bucket.sessions.size,
      }))
  }

  buildWatchDistribution(summaries: GrowthVideoEngagementSummary[]): GrowthVideoAnalyticsDistributionBucket[] {
    const buckets = [
      { label: "0–24%", min: 0, max: 24 },
      { label: "25–49%", min: 25, max: 49 },
      { label: "50–74%", min: 50, max: 74 },
      { label: "75–89%", min: 75, max: 89 },
      { label: "90%+", min: 90, max: 100 },
    ]

    return buckets.map((bucket) => ({
      label: bucket.label,
      count: summaries.filter(
        (row) => row.highestPercentWatched >= bucket.min && row.highestPercentWatched <= bucket.max,
      ).length,
    }))
  }

  buildEngagementScoreDistribution(
    summaries: GrowthVideoEngagementSummary[],
  ): GrowthVideoAnalyticsDistributionBucket[] {
    const buckets = [
      { label: "0–19", min: 0, max: 19 },
      { label: "20–39", min: 20, max: 39 },
      { label: "40–59", min: 40, max: 59 },
      { label: "60–79", min: 60, max: 79 },
      { label: "80+", min: 80, max: 200 },
    ]

    return buckets.map((bucket) => ({
      label: bucket.label,
      count: summaries.filter(
        (row) => row.engagementScore >= bucket.min && row.engagementScore <= bucket.max,
      ).length,
    }))
  }

  async buildTopAssets(
    filters: GrowthVideoAnalyticsFilters,
    limit = 5,
  ): Promise<GrowthVideoAnalyticsTopItem[]> {
    const summaries = await this.listSummaries(filters)
    const byAsset = new Map<string, { views: number; score: number; count: number }>()

    for (const summary of summaries) {
      const existing = byAsset.get(summary.videoAssetId) ?? { views: 0, score: 0, count: 0 }
      existing.views += summary.totalViews
      existing.score += summary.engagementScore
      existing.count += 1
      byAsset.set(summary.videoAssetId, existing)
    }

    const assetIds = [...byAsset.keys()]
    const titles = new Map<string, string>()
    if (assetIds.length > 0) {
      const { data } = await this.admin
        .schema("growth")
        .from("video_assets")
        .select("id, title")
        .eq("organization_id", filters.organizationId)
        .in("id", assetIds)
      for (const row of data ?? []) {
        titles.set(String((row as { id: string }).id), String((row as { title: string }).title))
      }
    }

    return [...byAsset.entries()]
      .map(([id, stats]) => ({
        id,
        title: titles.get(id) ?? "Video asset",
        views: stats.views,
        engagementScore: stats.count > 0 ? Math.round(stats.score / stats.count) : null,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, limit)
  }

  async buildTopPages(
    filters: GrowthVideoAnalyticsFilters,
    limit = 5,
  ): Promise<GrowthVideoAnalyticsTopItem[]> {
    const summaries = await this.listSummaries(filters)
    const byPage = new Map<string, { views: number; score: number; count: number }>()

    for (const summary of summaries) {
      const existing = byPage.get(summary.videoPageId) ?? { views: 0, score: 0, count: 0 }
      existing.views += summary.totalViews
      existing.score += summary.engagementScore
      existing.count += 1
      byPage.set(summary.videoPageId, existing)
    }

    const pageIds = [...byPage.keys()]
    const titles = new Map<string, string>()
    if (pageIds.length > 0) {
      const { data } = await this.admin
        .schema("growth")
        .from("video_pages")
        .select("id, title")
        .eq("organization_id", filters.organizationId)
        .in("id", pageIds)
      for (const row of data ?? []) {
        titles.set(String((row as { id: string }).id), String((row as { title: string }).title))
      }
    }

    return [...byPage.entries()]
      .map(([id, stats]) => ({
        id,
        title: titles.get(id) ?? "Video page",
        views: stats.views,
        engagementScore: stats.count > 0 ? Math.round(stats.score / stats.count) : null,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, limit)
  }
}

export function createGrowthVideoAnalyticsSummaryService(admin: SupabaseClient): GrowthVideoAnalyticsSummaryService {
  return new GrowthVideoAnalyticsSummaryService(admin)
}

export function growthVideoAnalyticsSummarySafetyPayload() {
  return {
    qa_marker: GROWTH_VIDEO_ANALYTICS_QA_MARKER,
    read_only_aggregation: true,
    no_automation_triggers: true,
    no_sequence_triggers: true,
    autonomous_execution_enabled: false,
  }
}
