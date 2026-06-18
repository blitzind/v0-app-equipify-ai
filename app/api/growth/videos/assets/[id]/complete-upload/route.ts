import { NextResponse } from "next/server"
import { growthVideoCompleteUploadSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import {
  completeGrowthVideoUpload,
  growthVideoUploadSafetyPayload,
} from "@/lib/growth/videos/growth-video-upload-service"
import {
  requireGrowthVideoPlatformAccess,
  requireGrowthVideoUploadSchemaReady,
} from "@/lib/growth/videos/growth-video-platform-access"
import { GROWTH_VIDEO_ASSETS_QA_MARKER } from "@/lib/growth/videos/growth-video-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const uploadSchemaBlock = await requireGrowthVideoUploadSchemaReady(access)
  if (uploadSchemaBlock) return uploadSchemaBlock

  const { id } = await context.params
  const parsed = growthVideoCompleteUploadSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await completeGrowthVideoUpload(access.admin, {
      organizationId: access.organizationId,
      assetId: id,
      fileSizeBytes: parsed.data.file_size_bytes,
      durationSeconds: parsed.data.duration_seconds,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        asset: result.asset,
        playbackUrl: result.playbackUrl,
        playbackExpiresAt: result.playbackExpiresAt,
        qa_marker: GROWTH_VIDEO_ASSETS_QA_MARKER,
        ...growthVideoUploadSafetyPayload(),
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
