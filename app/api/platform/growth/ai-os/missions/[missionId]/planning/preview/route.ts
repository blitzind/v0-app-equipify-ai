import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { previewExecutiveMissionPlanningReview } from "@/lib/growth/aios/ai-executive-mission-planning-review-service"
import {
  aiOsInvalidMissionIdResponse,
  aiOsPlanningReviewErrorStatus,
  resolveAiOsMissionIdFromRouteParam,
} from "@/lib/growth/aios/ai-os-mission-route-response"
import { GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER } from "@/lib/growth/aios/ai-executive-mission-planning-review-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ missionId: string }> }

const previewBodySchema = z.object({
  executiveRuntimeId: z.string().uuid().optional(),
  maxProposals: z.number().int().min(1).max(10).optional(),
})

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { missionId: rawMissionId } = await context.params
  const missionIdResult = resolveAiOsMissionIdFromRouteParam(rawMissionId)
  if (!missionIdResult.ok) {
    return aiOsInvalidMissionIdResponse(
      missionIdResult,
      GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER,
      "Could not run mission planning dry-run preview.",
    )
  }

  const organizationId = getGrowthEngineAiOrgId()

  let body: z.infer<typeof previewBodySchema> = {}
  try {
    const raw = await request.json()
    body = previewBodySchema.parse(raw)
  } catch {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER,
        error: "invalid_body",
        message: "Preview request body is invalid.",
      },
      { status: 400 },
    )
  }

  try {
    const preview = await previewExecutiveMissionPlanningReview(access.admin, {
      organizationId,
      missionId: missionIdResult.missionId,
      executiveRuntimeId: body.executiveRuntimeId,
      operatorUserId: access.userId,
      maxProposals: body.maxProposals,
      source: "growth_ai_os_mission_planning_preview_api",
    })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER,
      preview,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    const status = aiOsPlanningReviewErrorStatus(detail)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER,
        error: detail,
        message: "Could not run mission planning dry-run preview.",
      },
      { status },
    )
  }
}
