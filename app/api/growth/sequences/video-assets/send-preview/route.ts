import { NextResponse } from "next/server"
import { buildSequenceVideoSendPreview } from "@/lib/growth/sequences/growth-sequence-video-send-builder-service"
import { growthSequenceVideoSendPreviewSchema } from "@/lib/growth/sequences/growth-sequence-video-attachment-api-schema"
import {
  growthSequenceVideoAttachmentSafetyJson,
  mapGrowthSequenceVideoAttachmentApiError,
  requireGrowthSequenceVideoAttachmentPlatformAccess,
} from "@/lib/growth/sequences/growth-sequence-video-attachment-platform-access"
import { GROWTH_SEQUENCE_VIDEO_SEND_BUILDER_QA_MARKER } from "@/lib/growth/sequences/growth-sequence-video-attachment-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthSequenceVideoAttachmentPlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthSequenceVideoSendPreviewSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const preview = await buildSequenceVideoSendPreview(access.admin, {
      organizationId: access.organizationId,
      sequencePatternStepId: parsed.data.sequence_pattern_step_id,
      attachmentType: parsed.data.attachment_type,
      leadId: parsed.data.lead_id,
      sequenceExecutionJobId: parsed.data.sequence_execution_job_id ?? null,
      enrollmentStepId: parsed.data.enrollment_step_id ?? null,
    })

    return NextResponse.json(
      growthSequenceVideoAttachmentSafetyJson({
        ok: true,
        preview,
        qa_marker: GROWTH_SEQUENCE_VIDEO_SEND_BUILDER_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthSequenceVideoAttachmentApiError(error)
  }
}
