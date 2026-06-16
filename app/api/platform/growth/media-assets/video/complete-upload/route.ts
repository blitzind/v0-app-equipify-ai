import { NextResponse } from "next/server"
import { z } from "zod"
import { requireMediaAssetPlatformAccess } from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaVideoUploadError } from "@/lib/growth/media/media-video-upload-route-utils"
import {
  attachGrowthMediaVideoAsset,
  completeGrowthMediaVideoUpload,
  toGrowthMediaVideoAssetSummary,
} from "@/lib/growth/media/media-video-upload-service"
import {
  GROWTH_MEDIA_VIDEO_UPLOAD_QA_MARKER,
  GROWTH_MEDIA_VIDEO_UPLOAD_RELATIONSHIP_TYPES,
  GROWTH_MEDIA_VIDEO_UPLOAD_SAFETY_FLAGS,
} from "@/lib/growth/media/media-video-upload-types"

export const runtime = "nodejs"

const CompleteUploadSchema = z.object({
  asset_id: z.string().uuid(),
  checksum_sha256: z.string().min(64).max(64),
  file_size_bytes: z.number().int().positive(),
  duration_seconds: z.number().nonnegative().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  attach: z
    .object({
      relationship_type: z.enum(GROWTH_MEDIA_VIDEO_UPLOAD_RELATIONSHIP_TYPES),
      relationship_id: z.string().uuid(),
      metadata: z.record(z.unknown()).optional(),
    })
    .optional(),
})

export async function POST(request: Request) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const parsed = CompleteUploadSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    let asset = await completeGrowthMediaVideoUpload(access.admin, {
      organizationId: access.organizationId,
      assetId: parsed.data.asset_id,
      checksumSha256: parsed.data.checksum_sha256,
      fileSizeBytes: parsed.data.file_size_bytes,
      durationSeconds: parsed.data.duration_seconds,
      width: parsed.data.width,
      height: parsed.data.height,
    })

    if (parsed.data.attach) {
      asset = await attachGrowthMediaVideoAsset(access.admin, {
        organizationId: access.organizationId,
        assetId: asset.id,
        relationshipType: parsed.data.attach.relationship_type,
        relationshipId: parsed.data.attach.relationship_id,
        metadata: parsed.data.attach.metadata,
      })
    }

    return NextResponse.json({
      ok: true,
      asset: toGrowthMediaVideoAssetSummary(asset),
      requires_human_review: true,
      autonomous_execution_enabled: false,
      qa_marker: GROWTH_MEDIA_VIDEO_UPLOAD_QA_MARKER,
      ...GROWTH_MEDIA_VIDEO_UPLOAD_SAFETY_FLAGS,
    })
  } catch (error) {
    return mapMediaVideoUploadError(error)
  }
}
