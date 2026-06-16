import { NextResponse } from "next/server"
import { GROWTH_MEDIA_PLAYBACK_ANALYTICS_SAFETY_FLAGS } from "@/lib/growth/media/media-asset-analytics-types"
import { isGrowthMediaAssetAnalyticsSchemaReady } from "@/lib/growth/media/media-asset-analytics-schema-health"
import {
  GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER,
  getGrowthMediaPlaybackAnalyticsSummary,
} from "@/lib/growth/media/media-asset-analytics-service"
import { requireMediaAssetPlatformAccess } from "@/lib/growth/media/media-asset-platform-access"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthMediaAssetAnalyticsSchemaReady(access.admin))) {
    return NextResponse.json(
      { ok: false, error: "analytics_schema_not_ready" },
      { status: 503 },
    )
  }

  const url = new URL(request.url)
  const limit = Number(url.searchParams.get("limit") ?? "50")

  try {
    const summary = await getGrowthMediaPlaybackAnalyticsSummary(access.admin, {
      organizationId: access.organizationId,
      limit: Number.isFinite(limit) ? limit : 50,
    })

    return NextResponse.json({
      ok: true,
      items: summary.items,
      totals: summary.totals,
      qa_marker: GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER,
      ...GROWTH_MEDIA_PLAYBACK_ANALYTICS_SAFETY_FLAGS,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
  }
}
