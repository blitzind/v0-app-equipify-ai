import { NextResponse } from "next/server"
import { z } from "zod"
import { requireMediaAssetPlatformAccess } from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaVideoUploadError } from "@/lib/growth/media/media-video-upload-route-utils"
import {
  createGrowthMediaVideoAsset,
  toGrowthMediaVideoAssetSummary,
} from "@/lib/growth/media/media-video-upload-service"
import {
  GROWTH_MEDIA_VIDEO_MIME_TYPES,
  GROWTH_MEDIA_VIDEO_UPLOAD_QA_MARKER,
  GROWTH_MEDIA_VIDEO_UPLOAD_SAFETY_FLAGS,
} from "@/lib/growth/media/media-video-upload-types"

export const runtime = "nodejs"

const CreateVideoSchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(4000).optional(),
  original_filename: z.string().min(1).max(500),
  mime_type: z.enum(GROWTH_MEDIA_VIDEO_MIME_TYPES).optional(),
  file_size_bytes: z.number().int().positive().optional(),
  provider: z.enum(["local_stub", "supabase_storage"]).optional(),
  tags: z.array(z.string().min(1).max(80)).max(20).optional(),
})

export async function POST(request: Request) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const parsed = CreateVideoSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const asset = await createGrowthMediaVideoAsset(access.admin, {
      organizationId: access.organizationId,
      createdBy: access.userId,
      title: parsed.data.title,
      description: parsed.data.description,
      originalFilename: parsed.data.original_filename,
      mimeType: parsed.data.mime_type,
      fileSizeBytes: parsed.data.file_size_bytes ?? null,
      provider: parsed.data.provider,
      tags: parsed.data.tags,
    })
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
