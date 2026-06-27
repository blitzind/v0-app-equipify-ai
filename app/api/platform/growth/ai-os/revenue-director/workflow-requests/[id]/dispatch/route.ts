import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthOperatorAccess } from "@/lib/growth/access"
import { dispatchRevenueDirectorWorkflowRequest } from "@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-service"
import {
  GROWTH_REVENUE_DIRECTOR_DISPATCH_QA_MARKER,
  GROWTH_REVENUE_DIRECTOR_DISPATCH_RULE,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

function dispatchErrorStatus(error: string | null): number {
  switch (error) {
    case "schema_not_ready":
      return 503
    case "workflow_request_not_found":
      return 404
    case "invalid_status":
    case "dispatch_blocked":
    case "autonomy_blocked":
      return 409
    default:
      return 500
  }
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthOperatorAccess(request)
  if (!access.ok) return access.response

  const { id } = await context.params
  if (!id?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_REVENUE_DIRECTOR_DISPATCH_QA_MARKER,
        error: "workflow_request_id_required",
        message: "Workflow request id is required.",
      },
      { status: 400 },
    )
  }

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_REVENUE_DIRECTOR_DISPATCH_QA_MARKER,
        error: "growth_engine_ai_org_not_configured",
        message: "Growth Engine AI organization is not configured.",
      },
      { status: 503 },
    )
  }

  const result = await dispatchRevenueDirectorWorkflowRequest(access.admin, {
    organizationId,
    workflowRequestId: id.trim(),
    operatorUserId: access.userId,
    occurredAt: new Date().toISOString(),
  })

  if (!result.ok) {
    return NextResponse.json(result, { status: dispatchErrorStatus(result.error) })
  }

  return NextResponse.json({
    ...result,
    dispatchedByUserId: access.userId,
    advisoryOnly: false,
    transportBlocked: true,
  })
}
