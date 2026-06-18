import { NextResponse } from "next/server"
import { createGrowthVideoService } from "@/lib/growth/videos/growth-video-service"
import {
  growthVideoAssetCreateSchema,
  growthVideoAssetListQuerySchema,
} from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import {
  createGrowthVideoUploadAsset,
  growthVideoUploadSafetyPayload,
} from "@/lib/growth/videos/growth-video-upload-service"
import {
  requireGrowthVideoPlatformAccess,
  requireGrowthVideoUploadSchemaReady,
} from "@/lib/growth/videos/growth-video-platform-access"
import { GROWTH_VIDEO_ASSETS_QA_MARKER } from "@/lib/growth/videos/growth-video-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthVideoAssetListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const service = createGrowthVideoService(access.admin)
    const result = await service.listAssets({
      organizationId: access.organizationId,
      limit: parsed.data.limit,
      status: parsed.data.status,
      search: parsed.data.search,
    })
    if (!result.ok) return mapGrowthVideoApiError(new Error(result.error))

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        items: result.items,
        qa_marker: GROWTH_VIDEO_ASSETS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const uploadSchemaBlock = await requireGrowthVideoUploadSchemaReady(access)
  if (uploadSchemaBlock) return uploadSchemaBlock

  const parsed = growthVideoAssetCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const asset = await createGrowthVideoUploadAsset(access.admin, {
      organizationId: access.organizationId,
      createdBy: access.userId,
      title: parsed.data.title,
      description: parsed.data.description,
      originalFilename: parsed.data.original_filename,
      mimeType: parsed.data.mime_type,
      fileSizeBytes: parsed.data.file_size_bytes,
      sourceType: parsed.data.source_type ?? "upload",
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        asset,
        ...growthVideoUploadSafetyPayload(),
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
