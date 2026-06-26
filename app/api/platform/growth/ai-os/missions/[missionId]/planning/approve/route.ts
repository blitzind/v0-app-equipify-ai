import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { approveExecutiveMissionPlanningReview } from "@/lib/growth/aios/ai-executive-mission-planning-review-service"
import {
  aiOsInvalidMissionIdResponse,
  aiOsPlanningReviewErrorStatus,
  resolveAiOsMissionIdFromRouteParam,
} from "@/lib/growth/aios/ai-os-mission-route-response"
import { GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER } from "@/lib/growth/aios/ai-executive-mission-planning-review-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ missionId: string }> }

const approveBodySchema = z.object({
  reviewId: z.string().uuid(),
  executiveRuntimeId: z.string().uuid(),
  prepareDecision: z.boolean().optional(),
  enableAiEvidence: z.boolean().optional(),
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
      "Could not approve mission planning review.",
    )
  }

  const organizationId = getGrowthEngineAiOrgId()

  let body: z.infer<typeof approveBodySchema>
  try {
    const raw = await request.json()
    body = approveBodySchema.parse(raw)
  } catch {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER,
        error: "invalid_body",
        message: "Approve request body is invalid.",
      },
      { status: 400 },
    )
  }

  try {
    const approval = await approveExecutiveMissionPlanningReview(access.admin, {
      organizationId,
      missionId: missionIdResult.missionId,
      reviewId: body.reviewId,
      executiveRuntimeId: body.executiveRuntimeId,
      operatorUserId: access.userId,
      prepareDecision: body.prepareDecision,
      enableAiEvidence: body.enableAiEvidence,
      maxProposals: body.maxProposals,
      source: "growth_ai_os_mission_planning_approve_api",
    })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER,
      approval,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    const status = aiOsPlanningReviewErrorStatus(detail)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER,
        error: detail,
        message: "Could not approve mission planning review.",
      },
      { status },
    )
  }
}
