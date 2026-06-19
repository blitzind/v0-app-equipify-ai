import { NextResponse } from "next/server"
import { growthVideoAutopilotDraftBuildSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { buildGrowthVideoAutopilotDraftPackage } from "@/lib/growth/videos/growth-video-autopilot-draft-service"
import {
  GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER,
  growthVideoAutopilotDraftSafetyPayload,
} from "@/lib/growth/videos/growth-video-autopilot-draft-types"
import { requireGrowthVideoPlatformAccess } from "@/lib/growth/videos/growth-video-platform-access"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = growthVideoAutopilotDraftBuildSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const draft = await buildGrowthVideoAutopilotDraftPackage(access.admin, {
      organizationId: access.organizationId,
      leadId: parsed.data.lead_id,
      recommendationId: parsed.data.recommendation_id,
      draftId: id,
      videoAssetId: parsed.data.video_asset_id ?? null,
      automationNodeId: parsed.data.automation_node_id ?? null,
      sequencePatternStepId: parsed.data.sequence_pattern_step_id ?? null,
      automationFlowId: parsed.data.automation_flow_id ?? null,
      createdBy: access.userId,
      publicPreviewUrl: parsed.data.public_preview_url ?? null,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        draft,
        qa_marker: GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER,
        ...growthVideoAutopilotDraftSafetyPayload(),
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
