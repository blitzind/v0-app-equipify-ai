import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchExecutiveMissionPlanningReviewReadModel } from "@/lib/growth/aios/ai-executive-mission-planning-review-service"
import { GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER } from "@/lib/growth/aios/ai-executive-mission-planning-review-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ missionId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { missionId } = await context.params
  const organizationId = getGrowthEngineAiOrgId()

  try {
    const review = await fetchExecutiveMissionPlanningReviewReadModel(access.admin, {
      organizationId,
      missionId,
    })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER,
      review,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    const status = detail === "growth_objective_not_found" ? 404 : 500
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER,
        error: detail,
        message: "Could not load mission planning review.",
      },
      { status },
    )
  }
}
