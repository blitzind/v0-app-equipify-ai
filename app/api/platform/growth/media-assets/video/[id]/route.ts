import { NextResponse } from "next/server"
import { getMediaAsset } from "@/lib/growth/media/media-asset-repository"
import {
  assertMediaAssetOrgScope,
  requireMediaAssetPlatformAccess,
} from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaVideoUploadError } from "@/lib/growth/media/media-video-upload-route-utils"
import { toGrowthMediaVideoAssetSummary } from "@/lib/growth/media/media-video-upload-service"
import {
  GROWTH_MEDIA_VIDEO_UPLOAD_QA_MARKER,
  GROWTH_MEDIA_VIDEO_UPLOAD_SAFETY_FLAGS,
} from "@/lib/growth/media/media-video-upload-types"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  try {
    const asset = await getMediaAsset(access.admin, id)
    if (!asset) {
      return NextResponse.json({ ok: false, error: "asset_not_found" }, { status: 404 })
    }
    const scopeError = assertMediaAssetOrgScope(asset, access.organizationId)
    if (scopeError) return scopeError
    if (asset.assetType !== "video") {
      return NextResponse.json({ ok: false, error: "invalid_asset_type" }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      asset: toGrowthMediaVideoAssetSummary(asset),
      upload_state: asset.status,
      metadata: asset.metadata,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      qa_marker: GROWTH_MEDIA_VIDEO_UPLOAD_QA_MARKER,
      ...GROWTH_MEDIA_VIDEO_UPLOAD_SAFETY_FLAGS,
    })
  } catch (error) {
    return mapMediaVideoUploadError(error)
  }
}
