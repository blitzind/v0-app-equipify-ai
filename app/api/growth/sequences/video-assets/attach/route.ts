import { NextResponse } from "next/server"
import { attachGrowthSequenceVideoAsset } from "@/lib/growth/sequences/growth-sequence-video-attachment-service"
import { growthSequenceVideoAttachmentAttachSchema } from "@/lib/growth/sequences/growth-sequence-video-attachment-api-schema"
import {
  growthSequenceVideoAttachmentSafetyJson,
  mapGrowthSequenceVideoAttachmentApiError,
  requireGrowthSequenceVideoAttachmentPlatformAccess,
} from "@/lib/growth/sequences/growth-sequence-video-attachment-platform-access"
import { GROWTH_SEQUENCE_VIDEO_ATTACHMENT_QA_MARKER } from "@/lib/growth/sequences/growth-sequence-video-attachment-types"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthSequenceVideoAttachmentPlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthSequenceVideoAttachmentAttachSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const attachment = await attachGrowthSequenceVideoAsset(access.admin, {
      organizationId: access.organizationId,
      createdBy: access.userId,
      automationFlowId: parsed.data.automation_flow_id ?? null,
      automationNodeId: parsed.data.automation_node_id,
      sequencePatternStepId: parsed.data.sequence_pattern_step_id ?? null,
      attachmentType: parsed.data.attachment_type,
      videoAssetId: parsed.data.video_asset_id ?? null,
      videoPageId: parsed.data.video_page_id ?? null,
      voiceMediaAssetId: parsed.data.voice_media_asset_id ?? null,
      avatarMediaAssetId: parsed.data.avatar_media_asset_id ?? null,
      thumbnailUrl: parsed.data.thumbnail_url ?? null,
      metadataHooks: parsed.data.metadata_hooks,
    })

    return NextResponse.json(
      growthSequenceVideoAttachmentSafetyJson({
        ok: true,
        attachment,
        qa_marker: GROWTH_SEQUENCE_VIDEO_ATTACHMENT_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthSequenceVideoAttachmentApiError(error)
  }
}
