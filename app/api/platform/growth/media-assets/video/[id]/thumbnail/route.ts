import { NextResponse } from "next/server"
import { z } from "zod"
import {
  assertMediaAssetOrgScope,
  requireMediaAssetPlatformAccess,
} from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaVideoThumbnailError } from "@/lib/growth/media/media-video-thumbnail-route-utils"
import {
  completeGrowthMediaVideoThumbnailUpload,
  createGrowthMediaVideoThumbnailUploadSession,
  getGrowthMediaVideoThumbnail,
  removeGrowthMediaVideoThumbnail,
} from "@/lib/growth/media/media-video-thumbnail-service"
import {
  GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPES,
  GROWTH_MEDIA_VIDEO_THUMBNAIL_QA_MARKER,
  GROWTH_MEDIA_VIDEO_THUMBNAIL_SAFETY_FLAGS,
} from "@/lib/growth/media/media-video-thumbnail-types"

export const runtime = "nodejs"

const CreateSessionSchema = z.object({
  action: z.literal("create_session").optional(),
  mime_type: z.enum(GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPES).optional(),
  file_size_bytes: z.number().int().positive(),
  capture_timestamp_seconds: z.number().nonnegative().optional(),
  replace_existing: z.boolean().optional(),
  provider: z.enum(["local_stub", "supabase_storage"]).optional(),
})

const CompleteSchema = z.object({
  action: z.literal("complete"),
  thumbnail_asset_id: z.string().uuid(),
  checksum_sha256: z.string().length(64),
  file_size_bytes: z.number().int().positive(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
})

const RemoveSchema = z.object({
  action: z.literal("remove"),
})

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  try {
    const result = await getGrowthMediaVideoThumbnail(access.admin, {
      organizationId: access.organizationId,
      videoAssetId: id,
      includePreviewUrl: true,
    })
    const scopeError = assertMediaAssetOrgScope(result.video, access.organizationId)
    if (scopeError) return scopeError

    return NextResponse.json({
      ok: true,
      has_thumbnail: Boolean(result.thumbnail?.storageKey),
      thumbnail: result.thumbnail,
      parent_video_id: result.video.id,
      thumbnail_storage_key: result.video.thumbnailStorageKey,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      qa_marker: GROWTH_MEDIA_VIDEO_THUMBNAIL_QA_MARKER,
      ...GROWTH_MEDIA_VIDEO_THUMBNAIL_SAFETY_FLAGS,
    })
  } catch (error) {
    return mapMediaVideoThumbnailError(error)
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))

  try {
    if (body?.action === "remove") {
      RemoveSchema.parse(body)
      const video = await removeGrowthMediaVideoThumbnail(access.admin, {
        organizationId: access.organizationId,
        videoAssetId: id,
      })
      return NextResponse.json({
        ok: true,
        removed: true,
        parent_video_id: video.id,
        thumbnail_storage_key: video.thumbnailStorageKey,
        qa_marker: GROWTH_MEDIA_VIDEO_THUMBNAIL_QA_MARKER,
        ...GROWTH_MEDIA_VIDEO_THUMBNAIL_SAFETY_FLAGS,
      })
    }

    if (body?.action === "complete") {
      const parsed = CompleteSchema.parse(body)
      const result = await completeGrowthMediaVideoThumbnailUpload(access.admin, {
        organizationId: access.organizationId,
        videoAssetId: id,
        thumbnailAssetId: parsed.thumbnail_asset_id,
        checksumSha256: parsed.checksum_sha256,
        fileSizeBytes: parsed.file_size_bytes,
        width: parsed.width,
        height: parsed.height,
      })
      return NextResponse.json({
        ok: true,
        video: { id: result.video.id, thumbnail_storage_key: result.video.thumbnailStorageKey },
        thumbnail: {
          asset_id: result.thumbnail.id,
          storage_key: result.thumbnail.storageKey,
          mime_type: result.thumbnail.mimeType,
          file_size_bytes: result.thumbnail.fileSizeBytes,
          width: result.thumbnail.width,
          height: result.thumbnail.height,
          checksum_sha256: result.thumbnail.checksumSha256,
          status: result.thumbnail.status,
        },
        qa_marker: GROWTH_MEDIA_VIDEO_THUMBNAIL_QA_MARKER,
        ...GROWTH_MEDIA_VIDEO_THUMBNAIL_SAFETY_FLAGS,
      })
    }

    const parsed = CreateSessionSchema.parse(body)
    const result = await createGrowthMediaVideoThumbnailUploadSession(access.admin, {
      organizationId: access.organizationId,
      videoAssetId: id,
      createdBy: access.userId,
      mimeType: parsed.mime_type,
      fileSizeBytes: parsed.file_size_bytes,
      captureTimestampSeconds: parsed.capture_timestamp_seconds,
      provider: parsed.provider,
      replaceExisting: parsed.replace_existing,
    })

    return NextResponse.json({
      ok: true,
      upload_session: result.session,
      thumbnail_asset_id: result.thumbnailAsset.id,
      parent_video_id: result.video.id,
      signed_upload_only: true,
      qa_marker: GROWTH_MEDIA_VIDEO_THUMBNAIL_QA_MARKER,
      ...GROWTH_MEDIA_VIDEO_THUMBNAIL_SAFETY_FLAGS,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
    }
    return mapMediaVideoThumbnailError(error)
  }
}
