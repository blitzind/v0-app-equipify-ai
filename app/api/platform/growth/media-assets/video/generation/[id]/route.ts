import { NextResponse } from "next/server"
import { requireMediaAssetPlatformAccess } from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaVideoGenerationError } from "@/lib/growth/media/media-video-generation-route-utils"
import {
  getGenerationStatus,
  toGrowthMediaVideoGenerationResponse,
} from "@/lib/growth/media/media-video-generation-service"
import {
  GROWTH_MEDIA_VIDEO_GENERATION_QA_MARKER,
  GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS,
} from "@/lib/growth/media/media-video-generation-types"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  try {
    const { id } = await context.params
    const record = getGenerationStatus(id, access.organizationId)
    return NextResponse.json({
      ...toGrowthMediaVideoGenerationResponse(record),
      qa_marker: GROWTH_MEDIA_VIDEO_GENERATION_QA_MARKER,
      ...GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS,
    })
  } catch (error) {
    return mapMediaVideoGenerationError(error)
  }
}
