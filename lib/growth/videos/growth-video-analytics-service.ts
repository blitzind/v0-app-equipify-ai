import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_VIDEO_FOUNDATION_QA_MARKER, type GrowthVideoView } from "@/lib/growth/videos/growth-video-types"
import { isGrowthVideoViewsSchemaReady } from "@/lib/growth/videos/growth-video-schema-health"

const VIEW_SELECT =
  "id, organization_id, video_asset_id, visitor_identifier, session_id, watched_seconds, percent_watched, cta_clicked, meeting_booked, metadata_json, created_at"

type VideoViewRow = {
  id: string
  organization_id: string
  video_asset_id: string
  visitor_identifier: string | null
  session_id: string | null
  watched_seconds: number
  percent_watched: number
  cta_clicked: boolean
  meeting_booked: boolean
  metadata_json: Record<string, unknown> | null
  created_at: string
}

function mapViewRow(row: VideoViewRow): GrowthVideoView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    videoAssetId: row.video_asset_id,
    visitorIdentifier: row.visitor_identifier,
    sessionId: row.session_id,
    watchedSeconds: row.watched_seconds,
    percentWatched: row.percent_watched,
    ctaClicked: row.cta_clicked,
    meetingBooked: row.meeting_booked,
    metadata: row.metadata_json ?? {},
    createdAt: row.created_at,
  }
}

export type GrowthVideoAnalyticsSummary = {
  views: number
  watchRatePct: number | null
  ctaClicks: number
  meetingsBooked: number
}

export class GrowthVideoAnalyticsService {
  constructor(private readonly admin: SupabaseClient) {}

  async summarizeOrganization(input: {
    organizationId: string
    videoAssetId?: string | null
  }): Promise<{ ok: true; summary: GrowthVideoAnalyticsSummary } | { ok: false; error: string }> {
    if (!(await isGrowthVideoViewsSchemaReady(this.admin))) {
      return { ok: false, error: "schema_not_ready" }
    }

    let query = this.admin
      .schema("growth")
      .from("video_views")
      .select(VIEW_SELECT)
      .eq("organization_id", input.organizationId)
      .limit(500)

    if (input.videoAssetId) {
      query = query.eq("video_asset_id", input.videoAssetId)
    }

    const { data, error } = await query
    if (error) return { ok: false, error: error.message }

    const rows = (data as VideoViewRow[]) ?? []
    const views = rows.length
    const ctaClicks = rows.filter((row) => row.cta_clicked).length
    const meetingsBooked = rows.filter((row) => row.meeting_booked).length
    const watched = rows.filter((row) => row.watched_seconds > 0).length
    const watchRatePct = views > 0 ? Math.round((watched / views) * 100) : null

    return {
      ok: true,
      summary: {
        views,
        watchRatePct,
        ctaClicks,
        meetingsBooked,
      },
    }
  }

  async listRecentViews(input: {
    organizationId: string
    limit?: number
  }): Promise<{ ok: true; items: GrowthVideoView[] } | { ok: false; error: string }> {
    if (!(await isGrowthVideoViewsSchemaReady(this.admin))) {
      return { ok: false, error: "schema_not_ready" }
    }

    const { data, error } = await this.admin
      .schema("growth")
      .from("video_views")
      .select(VIEW_SELECT)
      .eq("organization_id", input.organizationId)
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 25)

    if (error) return { ok: false, error: error.message }
    return { ok: true, items: (data as VideoViewRow[]).map(mapViewRow) }
  }

  buildDiagnosticsPayload() {
    return {
      qa_marker: GROWTH_VIDEO_FOUNDATION_QA_MARKER,
      service: "growth_video_analytics_service",
      persistence: "growth.video_views",
    }
  }
}

export function createGrowthVideoAnalyticsService(admin: SupabaseClient): GrowthVideoAnalyticsService {
  return new GrowthVideoAnalyticsService(admin)
}
