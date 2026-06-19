import { NextResponse } from "next/server"
import { reviewGrowthSequenceVideoAttachment } from "@/lib/growth/sequences/growth-sequence-video-approval-service"
import { growthSequenceVideoAttachmentApproveSchema } from "@/lib/growth/sequences/growth-sequence-video-attachment-api-schema"
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

  const parsed = growthSequenceVideoAttachmentApproveSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const attachment = await reviewGrowthSequenceVideoAttachment(access.admin, {
      organizationId: access.organizationId,
      attachmentId: parsed.data.attachment_id,
      approvedBy: access.userId,
      action: parsed.data.action,
      replaceWith:
        parsed.data.action === "replace" && parsed.data.replace_with
          ? {
              automationFlowId: parsed.data.replace_with.automation_flow_id ?? null,
              automationNodeId: parsed.data.replace_with.automation_node_id ?? "",
              sequencePatternStepId: parsed.data.replace_with.sequence_pattern_step_id ?? null,
              attachmentType: parsed.data.replace_with.attachment_type ?? "email",
              videoAssetId: parsed.data.replace_with.video_asset_id ?? null,
              videoPageId: parsed.data.replace_with.video_page_id ?? null,
              voiceMediaAssetId: parsed.data.replace_with.voice_media_asset_id ?? null,
              avatarMediaAssetId: parsed.data.replace_with.avatar_media_asset_id ?? null,
              thumbnailUrl: parsed.data.replace_with.thumbnail_url ?? null,
              metadataHooks: parsed.data.replace_with.metadata_hooks,
            }
          : null,
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
