import { NextResponse } from "next/server"
import {
  getGrowthSequenceVideoAssetCatalog,
  listGrowthSequenceVideoAttachments,
} from "@/lib/growth/sequences/growth-sequence-video-attachment-service"
import { growthSequenceVideoAttachmentListSchema } from "@/lib/growth/sequences/growth-sequence-video-attachment-api-schema"
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

  const parsed = growthSequenceVideoAttachmentListSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const includeCatalog = new URL(request.url).searchParams.get("include_catalog") !== "false"
    const [attachments, catalogBundle] = await Promise.all([
      listGrowthSequenceVideoAttachments(access.admin, {
        organizationId: access.organizationId,
        automationFlowId: parsed.data.automation_flow_id ?? null,
        automationNodeId: parsed.data.automation_node_id ?? null,
        sequencePatternStepId: parsed.data.sequence_pattern_step_id ?? null,
        attachmentType: parsed.data.attachment_type ?? null,
        attachmentStatus: parsed.data.attachment_status ?? null,
      }),
      includeCatalog
        ? getGrowthSequenceVideoAssetCatalog(access.admin, { organizationId: access.organizationId })
        : Promise.resolve(null),
    ])

    return NextResponse.json(
      growthSequenceVideoAttachmentSafetyJson({
        ok: true,
        attachments,
        catalog: catalogBundle?.catalog ?? null,
        approved_attachments: catalogBundle?.attachments ?? null,
        qa_marker: GROWTH_SEQUENCE_VIDEO_ATTACHMENT_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthSequenceVideoAttachmentApiError(error)
  }
}
