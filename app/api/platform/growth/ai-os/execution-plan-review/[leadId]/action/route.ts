import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { submitGrowthLeadResearchExecutionPlanReviewAction } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-service"
import {
  GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_ACTIONS,
  GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_QA_MARKER,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ leadId: string }> }

const actionBodySchema = z.object({
  planId: z.string().min(1),
  action: z.enum(GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_ACTIONS),
  note: z.string().max(500).optional(),
})

function actionErrorStatus(error: string): number {
  if (error === "execution_plan_not_found" || error === "execution_plan_id_mismatch") return 404
  if (error === "growth_lead_research_workflow_disabled") return 403
  return 500
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!leadId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_QA_MARKER,
        error: "lead_id_required",
        message: "Lead id is required.",
      },
      { status: 400 },
    )
  }

  let body: z.infer<typeof actionBodySchema>
  try {
    body = actionBodySchema.parse(await request.json())
  } catch {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_QA_MARKER,
        error: "invalid_body",
        message: "Review action body is invalid.",
      },
      { status: 400 },
    )
  }

  const organizationId = getGrowthEngineAiOrgId()

  try {
    const review = await submitGrowthLeadResearchExecutionPlanReviewAction(access.admin, {
      organizationId,
      leadId,
      planId: body.planId,
      action: body.action,
      operatorUserId: access.userId,
      note: body.note ?? null,
      source: "growth_ai_os_execution_plan_review_api",
    })

    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_QA_MARKER,
      review,
      planningOnly: true,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_QA_MARKER,
        error: detail,
        message: "Could not record execution plan review action.",
      },
      { status: actionErrorStatus(detail) },
    )
  }
}
