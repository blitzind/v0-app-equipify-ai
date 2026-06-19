import { NextResponse } from "next/server"
import { growthVideoAutopilotListQuerySchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { listGrowthVideoAutopilotRecommendations } from "@/lib/growth/videos/growth-video-autopilot-service"
import { GROWTH_VIDEO_AUTOPILOT_QA_MARKER } from "@/lib/growth/videos/growth-video-autopilot-types"
import { requireGrowthVideoPlatformAccess } from "@/lib/growth/videos/growth-video-platform-access"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthVideoAutopilotListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const recommendations = await listGrowthVideoAutopilotRecommendations(access.admin, {
      organizationId: access.organizationId,
      leadId: parsed.data.lead_id,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        recommendations,
        qa_marker: GROWTH_VIDEO_AUTOPILOT_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
