import { NextResponse } from "next/server"
import { z } from "zod"
import {
  GROWTH_MEDIA_PLAYBACK_ANALYTICS_EVENT_TYPES,
  GROWTH_MEDIA_PLAYBACK_ANALYTICS_SAFETY_FLAGS,
} from "@/lib/growth/media/media-asset-analytics-types"
import { isGrowthMediaAssetAnalyticsSchemaReady } from "@/lib/growth/media/media-asset-analytics-schema-health"
import {
  GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER,
  ingestGrowthMediaPlaybackAnalyticsEvent,
} from "@/lib/growth/media/media-asset-analytics-service"
import { requireMediaAssetPlatformAccess } from "@/lib/growth/media/media-asset-platform-access"

export const runtime = "nodejs"

const EventSchema = z.object({
  asset_id: z.string().uuid(),
  event_type: z.enum(GROWTH_MEDIA_PLAYBACK_ANALYTICS_EVENT_TYPES),
  session_id: z.string().min(1).max(200),
  tracking_token: z.string().min(1).max(500).optional(),
  relationship_id: z.string().uuid().nullable().optional(),
  lead_id: z.string().uuid().nullable().optional(),
  share_page_id: z.string().uuid().nullable().optional(),
  template_id: z.string().uuid().nullable().optional(),
  sequence_id: z.string().uuid().nullable().optional(),
  anonymous_id_hash: z.string().max(128).nullable().optional(),
  progress_seconds: z.number().nonnegative().nullable().optional(),
  progress_percent: z.number().min(0).max(100).nullable().optional(),
  duration_seconds: z.number().nonnegative().nullable().optional(),
  cta_key: z.string().max(120).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  event_timestamp: z.string().datetime().optional(),
})

export async function POST(request: Request) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthMediaAssetAnalyticsSchemaReady(access.admin))) {
    return NextResponse.json(
      { ok: false, error: "analytics_schema_not_ready", message: "Apply S2-D migration locally first." },
      { status: 503 },
    )
  }

  const parsed = EventSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await ingestGrowthMediaPlaybackAnalyticsEvent(access.admin, {
      organizationId: access.organizationId,
      assetId: parsed.data.asset_id,
      eventType: parsed.data.event_type,
      sessionId: parsed.data.session_id,
      trackingToken: parsed.data.tracking_token ?? null,
      ingestSource: parsed.data.tracking_token ? "client_hook" : "platform_admin",
      relationshipId: parsed.data.relationship_id,
      leadId: parsed.data.lead_id,
      sharePageId: parsed.data.share_page_id,
      templateId: parsed.data.template_id,
      sequenceId: parsed.data.sequence_id,
      anonymousIdHash: parsed.data.anonymous_id_hash,
      progressSeconds: parsed.data.progress_seconds,
      progressPercent: parsed.data.progress_percent,
      durationSeconds: parsed.data.duration_seconds,
      ctaKey: parsed.data.cta_key,
      metadata: parsed.data.metadata,
      eventTimestamp: parsed.data.event_timestamp,
    })

    return NextResponse.json({
      ok: true,
      event_id: result.event.id,
      rollup: result.rollup,
      qa_marker: GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER,
      ...GROWTH_MEDIA_PLAYBACK_ANALYTICS_SAFETY_FLAGS,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === "asset_not_found") {
      return NextResponse.json({ ok: false, error: message }, { status: 404 })
    }
    if (message === "organization_scope_mismatch") {
      return NextResponse.json({ ok: false, error: message }, { status: 403 })
    }
    if (
      message === "tracking_token_required" ||
      message === "invalid_event_type" ||
      message === "invalid_asset_type" ||
      message === "session_id_required"
    ) {
      return NextResponse.json({ ok: false, error: message }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
  }
}
