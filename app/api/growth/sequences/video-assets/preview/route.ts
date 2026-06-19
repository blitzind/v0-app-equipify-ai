import { NextResponse } from "next/server"
import { buildSequenceVideoAttachmentPreview } from "@/lib/growth/sequences/growth-sequence-video-preview-service"
import { growthSequenceVideoAttachmentPreviewSchema } from "@/lib/growth/sequences/growth-sequence-video-attachment-api-schema"
import {
  growthSequenceVideoAttachmentSafetyJson,
  mapGrowthSequenceVideoAttachmentApiError,
  requireGrowthSequenceVideoAttachmentPlatformAccess,
} from "@/lib/growth/sequences/growth-sequence-video-attachment-platform-access"
import { GROWTH_SEQUENCE_VIDEO_ATTACHMENT_QA_MARKER } from "@/lib/growth/sequences/growth-sequence-video-attachment-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthSequenceVideoAttachmentPlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthSequenceVideoAttachmentPreviewSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const preview = await buildSequenceVideoAttachmentPreview(access.admin, {
      organizationId: access.organizationId,
      attachmentId: parsed.data.attachment_id ?? null,
      attachmentType: parsed.data.attachment_type,
      videoPageId: parsed.data.video_page_id ?? null,
      voiceMediaAssetId: parsed.data.voice_media_asset_id ?? null,
      avatarMediaAssetId: parsed.data.avatar_media_asset_id ?? null,
      thumbnailUrl: parsed.data.thumbnail_url ?? null,
      previewFirstName: parsed.data.preview_first_name ?? null,
    })

    return NextResponse.json(
      growthSequenceVideoAttachmentSafetyJson({
        ok: true,
        ...preview,
        qa_marker: GROWTH_SEQUENCE_VIDEO_ATTACHMENT_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthSequenceVideoAttachmentApiError(error)
  }
}
