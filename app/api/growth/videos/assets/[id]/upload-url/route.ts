import { NextResponse } from "next/server"
import { growthVideoUploadUrlSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import {
  createGrowthVideoUploadUrl,
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
  const parsed = growthVideoUploadUrlSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const session = await createGrowthVideoUploadUrl(access.admin, {
      organizationId: access.organizationId,
      assetId: id,
      mimeType: parsed.data.mime_type,
      fileSizeBytes: parsed.data.file_size_bytes,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        ...session,
        qa_marker: GROWTH_VIDEO_ASSETS_QA_MARKER,
        ...growthVideoUploadSafetyPayload(),
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
