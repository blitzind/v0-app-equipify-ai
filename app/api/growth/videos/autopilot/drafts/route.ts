import { NextResponse } from "next/server"
import { growthVideoAutopilotDraftListQuerySchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { listGrowthVideoAutopilotDrafts } from "@/lib/growth/videos/growth-video-autopilot-draft-service"
import {
  GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER,
  growthVideoAutopilotDraftSafetyPayload,
} from "@/lib/growth/videos/growth-video-autopilot-draft-types"
import { requireGrowthVideoPlatformAccess } from "@/lib/growth/videos/growth-video-platform-access"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthVideoAutopilotDraftListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const drafts = await listGrowthVideoAutopilotDrafts(access.admin, {
      organizationId: access.organizationId,
      leadId: parsed.data.lead_id,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        drafts,
        qa_marker: GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER,
        ...growthVideoAutopilotDraftSafetyPayload(),
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
