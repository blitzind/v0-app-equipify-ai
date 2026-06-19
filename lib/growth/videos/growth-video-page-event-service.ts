import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_VIDEO_PAGES_QA_MARKER,
  type GrowthVideoPageEvent,
  type GrowthVideoPageEventType,
} from "@/lib/growth/videos/growth-video-types"
import { assertGrowthVideoPageEventType } from "@/lib/growth/videos/growth-video-page-validation"
import { isGrowthVideoPagesSchemaReady } from "@/lib/growth/videos/growth-video-schema-health"
import { processGrowthVideoPageEventIntelligence } from "@/lib/growth/sequences/growth-sequence-video-intelligence-service"

type VideoPageEventRow = {
  id: string
  organization_id: string
  video_page_id: string
  video_asset_id: string
  event_type: string
  visitor_identifier: string | null
  session_id: string | null
  metadata_json: Record<string, unknown> | null
  created_at: string
}

function mapEventRow(row: VideoPageEventRow): GrowthVideoPageEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    videoPageId: row.video_page_id,
    videoAssetId: row.video_asset_id,
    eventType: row.event_type as GrowthVideoPageEventType,
    visitorIdentifier: row.visitor_identifier,
    sessionId: row.session_id,
    metadata: row.metadata_json ?? {},
    createdAt: row.created_at,
  }
}

export class GrowthVideoPageEventService {
  constructor(private readonly admin: SupabaseClient) {}

  async ingestPublicEvent(input: {
    slug: string
    eventType: string
    sessionId: string
    visitorIdentifier?: string | null
    metadata?: Record<string, unknown>
  }): Promise<{ ok: true; event: GrowthVideoPageEvent } | { ok: false; error: string }> {
    if (!(await isGrowthVideoPagesSchemaReady(this.admin))) {
      return { ok: false, error: "pages_schema_not_ready" }
    }

    const eventType = assertGrowthVideoPageEventType(input.eventType)
    const sessionId = input.sessionId.trim().slice(0, 120)
    if (!sessionId) return { ok: false, error: "invalid_session" }

    const { data: pages, error: pageError } = await this.admin
      .schema("growth")
      .from("video_pages")
      .select("id, organization_id, video_asset_id, status, metadata_json")
      .eq("slug", input.slug.trim().toLowerCase())
      .eq("status", "published")
      .limit(2)

    if (pageError) return { ok: false, error: pageError.message }
    if (!pages?.length) return { ok: false, error: "not_found" }
    if (pages.length > 1) return { ok: false, error: "ambiguous_slug" }

    const page = pages[0] as {
      id: string
      organization_id: string
      video_asset_id: string
      metadata_json: Record<string, unknown> | null
    }

    const visitorIdentifier = input.visitorIdentifier?.trim().slice(0, 128) ?? null
    const metadata = input.metadata ?? {}
    const pageMetadata = (page.metadata_json ?? {}) as Record<string, unknown>

    const { data, error } = await this.admin
      .schema("growth")
      .from("video_page_events")
      .insert({
        organization_id: page.organization_id,
        video_page_id: page.id,
        video_asset_id: page.video_asset_id,
        event_type: eventType,
        visitor_identifier: visitorIdentifier,
        session_id: sessionId,
        metadata_json: {
          ...metadata,
          qa_marker: GROWTH_VIDEO_PAGES_QA_MARKER,
        },
      })
      .select(
        "id, organization_id, video_page_id, video_asset_id, event_type, visitor_identifier, session_id, metadata_json, created_at",
      )
      .single()

    if (!error) {
      void processGrowthVideoPageEventIntelligence(this.admin, {
        organizationId: page.organization_id,
        videoPageId: page.id,
        sessionId,
        leadId:
          (typeof metadata.lead_id === "string" ? metadata.lead_id : null) ??
          (typeof pageMetadata.lead_id === "string" ? pageMetadata.lead_id : null),
      }).catch(() => undefined)
    }

    if (error) return { ok: false, error: error.message }
    return { ok: true, event: mapEventRow(data as VideoPageEventRow) }
  }
}

export function createGrowthVideoPageEventService(admin: SupabaseClient): GrowthVideoPageEventService {
  return new GrowthVideoPageEventService(admin)
}

export function growthVideoPageEventSafetyPayload() {
  return {
    qa_marker: GROWTH_VIDEO_PAGES_QA_MARKER,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    public_tracking_only: true,
  }
}
