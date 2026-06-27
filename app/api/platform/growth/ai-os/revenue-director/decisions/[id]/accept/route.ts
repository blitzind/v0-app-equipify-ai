import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthOperatorAccess } from "@/lib/growth/access"
import { acceptRevenueDirectorDecision } from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-service"
import {
  GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
  GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_RULE,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

function mutationErrorStatus(error: string | null): number {
  switch (error) {
    case "schema_not_ready":
      return 503
    case "decision_not_found":
      return 404
    case "invalid_transition":
      return 409
    default:
      return 403
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
        qaMarker: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
        error: "decision_id_required",
        message: "Decision id is required.",
      },
      { status: 400 },
    )
  }

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
        error: "growth_engine_ai_org_not_configured",
        message: "Growth Engine AI organization is not configured.",
      },
      { status: 503 },
    )
  }

  const result = await acceptRevenueDirectorDecision(access.admin, {
    organizationId,
    decisionId: id.trim(),
    operatorUserId: access.userId,
    occurredAt: new Date().toISOString(),
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
        rule: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_RULE,
        error: result.error,
        message: result.message,
        dispatched: false,
        sendOccurred: false,
      },
      { status: mutationErrorStatus(result.error) },
    )
  }

  return NextResponse.json({
    ok: true,
    qaMarker: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
    rule: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_RULE,
    decision: result.decision,
    workflowRequests: result.workflowRequests,
    acceptedByUserId: access.userId,
    dispatched: false,
    sendOccurred: false,
    advisoryOnly: true,
  })
}
