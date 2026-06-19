import { NextResponse } from "next/server"
import {
  growthVideoAutopilotRecommendationQuerySchema,
  growthVideoAutopilotReviewSchema,
} from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import {
  buildGrowthVideoAutopilotPreviewBundle,
  getGrowthVideoAutopilotRecommendation,
  reviewGrowthVideoAutopilotRecommendation,
} from "@/lib/growth/videos/growth-video-autopilot-service"
import { GROWTH_VIDEO_AUTOPILOT_QA_MARKER } from "@/lib/growth/videos/growth-video-autopilot-types"
import { requireGrowthVideoPlatformAccess } from "@/lib/growth/videos/growth-video-platform-access"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = growthVideoAutopilotRecommendationQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const recommendation = await getGrowthVideoAutopilotRecommendation(access.admin, {
      organizationId: access.organizationId,
      leadId: parsed.data.lead_id,
      recommendationId: id,
    })
    if (!recommendation) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    }

    const preview = buildGrowthVideoAutopilotPreviewBundle({ recommendation })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        recommendation,
        preview,
        qa_marker: GROWTH_VIDEO_AUTOPILOT_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = growthVideoAutopilotReviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const recommendation = await reviewGrowthVideoAutopilotRecommendation(access.admin, {
      organizationId: access.organizationId,
      leadId: parsed.data.lead_id,
      recommendationId: id,
      status: parsed.data.status,
      actorUserId: access.userId,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        recommendation,
        qa_marker: GROWTH_VIDEO_AUTOPILOT_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
