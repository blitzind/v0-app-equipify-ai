import { NextResponse } from "next/server"
import { z } from "zod"
import { requireMediaAssetPlatformAccess } from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaVideoUploadError } from "@/lib/growth/media/media-video-upload-route-utils"
import { createGrowthMediaVideoUploadSession } from "@/lib/growth/media/media-video-upload-service"
import {
  DEFAULT_GROWTH_MEDIA_VIDEO_MAX_BYTES,
  GROWTH_MEDIA_VIDEO_MIME_TYPES,
  GROWTH_MEDIA_VIDEO_UPLOAD_QA_MARKER,
  GROWTH_MEDIA_VIDEO_UPLOAD_SAFETY_FLAGS,
} from "@/lib/growth/media/media-video-upload-types"

export const runtime = "nodejs"

const UploadSessionSchema = z.object({
  asset_id: z.string().uuid(),
  mime_type: z.enum(GROWTH_MEDIA_VIDEO_MIME_TYPES).optional(),
  file_size_bytes: z.number().int().positive(),
  signed_url_ttl_seconds: z.number().int().positive().max(86400).optional(),
})

export async function POST(request: Request) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const parsed = UploadSessionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await createGrowthMediaVideoUploadSession(access.admin, {
      organizationId: access.organizationId,
      assetId: parsed.data.asset_id,
      mimeType: parsed.data.mime_type,
      fileSizeBytes: parsed.data.file_size_bytes,
      signedUrlTtlSeconds: parsed.data.signed_url_ttl_seconds,
    })

    return NextResponse.json({
      ok: true,
      asset: {
        id: result.asset.id,
        status: result.asset.status,
      },
      upload_session: {
        sessionId: result.session.sessionId,
        assetId: result.session.assetId,
        storageKey: result.session.storageKey,
        signedUploadUrl: result.session.writeUrl,
        expiresAt: result.session.expiresAt,
        mimeType: parsed.data.mime_type ?? result.asset.mimeType ?? "video/mp4",
        maxBytes: DEFAULT_GROWTH_MEDIA_VIDEO_MAX_BYTES,
      },
      signed_upload_only: true,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      qa_marker: GROWTH_MEDIA_VIDEO_UPLOAD_QA_MARKER,
      ...GROWTH_MEDIA_VIDEO_UPLOAD_SAFETY_FLAGS,
    })
  } catch (error) {
    return mapMediaVideoUploadError(error)
  }
}
