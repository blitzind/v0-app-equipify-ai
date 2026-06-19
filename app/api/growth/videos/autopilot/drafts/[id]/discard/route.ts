import { NextResponse } from "next/server"
import { growthVideoAutopilotDraftDiscardSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { discardGrowthVideoAutopilotDraft } from "@/lib/growth/videos/growth-video-autopilot-draft-service"
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
  const parsed = growthVideoAutopilotDraftDiscardSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const draft = await discardGrowthVideoAutopilotDraft(access.admin, {
      organizationId: access.organizationId,
      leadId: parsed.data.lead_id,
      draftId: id,
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
