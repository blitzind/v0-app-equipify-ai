import { NextResponse } from "next/server"
import {
  GROWTH_MEDIA_PLAYBACK_ANALYTICS_SAFETY_FLAGS,
} from "@/lib/growth/media/media-asset-analytics-types"
import { isGrowthMediaAssetAnalyticsSchemaReady } from "@/lib/growth/media/media-asset-analytics-schema-health"
import {
  GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER,
  getGrowthMediaAssetPlaybackAnalytics,
} from "@/lib/growth/media/media-asset-analytics-service"
import {
  assertMediaAssetOrgScope,
  requireMediaAssetPlatformAccess,
} from "@/lib/growth/media/media-asset-platform-access"
import { getMediaAsset } from "@/lib/growth/media/media-asset-repository"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthMediaAssetAnalyticsSchemaReady(access.admin))) {
    return NextResponse.json(
      { ok: false, error: "analytics_schema_not_ready" },
      { status: 503 },
    )
  }

  const { id } = await context.params
  try {
    const asset = await getMediaAsset(access.admin, id)
    if (!asset) {
      return NextResponse.json({ ok: false, error: "asset_not_found" }, { status: 404 })
    }
    const scopeError = assertMediaAssetOrgScope(asset, access.organizationId)
    if (scopeError) return scopeError

    const analytics = await getGrowthMediaAssetPlaybackAnalytics(access.admin, {
      organizationId: access.organizationId,
      assetId: id,
    })

    return NextResponse.json({
      ok: true,
      asset_id: analytics.assetId,
      rollup: analytics.rollup,
      qa_marker: GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER,
      ...GROWTH_MEDIA_PLAYBACK_ANALYTICS_SAFETY_FLAGS,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
  }
}
