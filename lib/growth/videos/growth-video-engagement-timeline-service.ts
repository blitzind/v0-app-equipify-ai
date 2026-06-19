import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_VIDEO_ANALYTICS_QA_MARKER,
  type GrowthVideoEngagementTimelineStep,
  type GrowthVideoPageEventType,
} from "@/lib/growth/videos/growth-video-types"
import { isGrowthVideoPageEventsSchemaReady } from "@/lib/growth/videos/growth-video-schema-health"

const EVENT_SELECT =
  "id, organization_id, video_asset_id, video_page_id, event_type, session_id, metadata_json, created_at"

type EventRow = {
  id: string
  organization_id: string
  video_asset_id: string
  video_page_id: string
  event_type: string
  session_id: string | null
  metadata_json: Record<string, unknown> | null
  created_at: string
}

const TIMELINE_LABELS: Record<GrowthVideoPageEventType, string> = {
  page_view: "Page viewed",
  video_play: "Video played",
  video_progress: "Watched progress",
  video_complete: "Video completed",
  cta_click: "Clicked CTA",
  calendar_click: "Opened calendar",
}

function labelForEvent(row: EventRow): string {
  const eventType = row.event_type as GrowthVideoPageEventType
  const base = TIMELINE_LABELS[eventType] ?? row.event_type
  const percent = row.metadata_json?.percent ?? row.metadata_json?.progress_pct
  if (eventType === "video_progress" && typeof percent === "number") {
    return `Watched ${Math.round(percent)}%`
  }
  if (eventType === "video_complete") return "Watched 90%+"
  return base
}

export class GrowthVideoEngagementTimelineService {
  constructor(private readonly admin: SupabaseClient) {}

  async listTimeline(input: {
    organizationId: string
    videoAssetId?: string | null
    videoPageId?: string | null
    sessionId?: string | null
    visitorIdentifier?: string | null
    limit?: number
  }): Promise<{ ok: true; items: GrowthVideoEngagementTimelineStep[] } | { ok: false; error: string }> {
    if (!(await isGrowthVideoPageEventsSchemaReady(this.admin))) {
      return { ok: false, error: "page_events_schema_not_ready" }
    }

    let query = this.admin
      .schema("growth")
      .from("video_page_events")
      .select(EVENT_SELECT)
      .eq("organization_id", input.organizationId)
      .order("created_at", { ascending: true })
      .limit(input.limit ?? 200)

    if (input.videoAssetId) query = query.eq("video_asset_id", input.videoAssetId)
    if (input.videoPageId) query = query.eq("video_page_id", input.videoPageId)
    if (input.sessionId) query = query.eq("session_id", input.sessionId)
    if (input.visitorIdentifier) query = query.eq("visitor_identifier", input.visitorIdentifier)

    const { data, error } = await query
    if (error) return { ok: false, error: error.message }

    const rows = (data as EventRow[]) ?? []
    const items: GrowthVideoEngagementTimelineStep[] = rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      label: labelForEvent(row),
      occurredAt: row.created_at,
      sessionId: row.session_id,
      videoPageId: row.video_page_id,
      videoAssetId: row.video_asset_id,
      metadata: row.metadata_json ?? {},
    }))

    return { ok: true, items }
  }

  buildVisitorJourneyLabels(items: GrowthVideoEngagementTimelineStep[]): string[] {
    return items.map((item) => item.label)
  }
}

export function createGrowthVideoEngagementTimelineService(
  admin: SupabaseClient,
): GrowthVideoEngagementTimelineService {
  return new GrowthVideoEngagementTimelineService(admin)
}

export function growthVideoEngagementTimelineSafetyPayload() {
  return {
    qa_marker: GROWTH_VIDEO_ANALYTICS_QA_MARKER,
    read_only: true,
    no_automation_triggers: true,
  }
}
