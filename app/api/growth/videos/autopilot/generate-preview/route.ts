import { NextResponse } from "next/server"
import { growthVideoAutopilotGeneratePreviewSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { generateGrowthVideoAutopilotRecommendation } from "@/lib/growth/videos/growth-video-autopilot-service"
import { GROWTH_VIDEO_AUTOPILOT_QA_MARKER } from "@/lib/growth/videos/growth-video-autopilot-types"
import { requireGrowthVideoPlatformAccess } from "@/lib/growth/videos/growth-video-platform-access"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthVideoAutopilotGeneratePreviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await generateGrowthVideoAutopilotRecommendation(access.admin, {
      organizationId: access.organizationId,
      leadId: parsed.data.lead_id,
      persist: parsed.data.persist ?? true,
      publicPreviewUrl: parsed.data.public_preview_url ?? null,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        recommendation: result.recommendation,
        preview: result.preview,
        qa_marker: GROWTH_VIDEO_AUTOPILOT_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
