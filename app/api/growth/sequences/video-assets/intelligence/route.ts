import { NextResponse } from "next/server"
import { growthSequenceVideoIntelligenceDiagnosticsSchema } from "@/lib/growth/sequences/growth-sequence-video-attachment-api-schema"
import {
  growthSequenceVideoAttachmentSafetyJson,
  mapGrowthSequenceVideoAttachmentApiError,
  requireGrowthSequenceVideoAttachmentPlatformAccess,
} from "@/lib/growth/sequences/growth-sequence-video-attachment-platform-access"
import {
  loadGrowthVideoIntelligenceForAttachment,
  resolveGrowthVideoIntelligenceSnapshot,
} from "@/lib/growth/sequences/growth-sequence-video-intelligence-service"
import { GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_QA_MARKER } from "@/lib/growth/sequences/growth-sequence-video-intelligence-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthSequenceVideoAttachmentPlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthSequenceVideoIntelligenceDiagnosticsSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const snapshot = parsed.data.attachment_id
      ? await loadGrowthVideoIntelligenceForAttachment(access.admin, {
          organizationId: access.organizationId,
          attachmentId: parsed.data.attachment_id,
          leadId: parsed.data.lead_id ?? null,
        })
      : parsed.data.video_page_id
        ? await resolveGrowthVideoIntelligenceSnapshot(access.admin, {
            organizationId: access.organizationId,
            videoPageId: parsed.data.video_page_id,
            leadId: parsed.data.lead_id ?? null,
            attachmentId: null,
            sessionId: parsed.data.session_id ?? null,
          })
        : null

    if (!snapshot) {
      return NextResponse.json(
        growthSequenceVideoAttachmentSafetyJson({
          ok: true,
          intelligence: null,
          qa_marker: GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_QA_MARKER,
        }),
      )
    }

    return NextResponse.json(
      growthSequenceVideoAttachmentSafetyJson({
        ok: true,
        intelligence: {
          timelineEvents: snapshot.timelineEvents,
          conversationActivities: snapshot.conversationActivities,
          relationshipContext: snapshot.relationshipContext,
          nextBestActionSuggestions: snapshot.nextBestActionSuggestions,
          opportunitySignals: snapshot.opportunitySignals,
          callWorkspaceContext: snapshot.callWorkspaceContext,
          meetingPreparationContext: snapshot.meetingPreparationContext,
          metrics: snapshot.metrics,
          signals: snapshot.signals,
          analyticsAttribution: snapshot.analyticsAttribution,
        },
        qa_marker: GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthSequenceVideoAttachmentApiError(error)
  }
}
