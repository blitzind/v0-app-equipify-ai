import { NextResponse } from "next/server"
import { listSequenceVideoAttachmentAnalyticsDiagnostics } from "@/lib/growth/sequences/growth-sequence-video-engagement-service"
import { growthSequenceVideoAnalyticsDiagnosticsSchema } from "@/lib/growth/sequences/growth-sequence-video-attachment-api-schema"
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

  const parsed = growthSequenceVideoAnalyticsDiagnosticsSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const diagnostics = await listSequenceVideoAttachmentAnalyticsDiagnostics(access.admin, {
      organizationId: access.organizationId,
      attachmentId: parsed.data.attachment_id,
      leadId: parsed.data.lead_id ?? null,
    })

    return NextResponse.json(
      growthSequenceVideoAttachmentSafetyJson({
        ok: true,
        ...diagnostics,
        qa_marker: GROWTH_SEQUENCE_VIDEO_SEND_BUILDER_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthSequenceVideoAttachmentApiError(error)
  }
}
