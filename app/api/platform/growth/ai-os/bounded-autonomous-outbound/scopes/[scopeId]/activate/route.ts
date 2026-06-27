import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthOperatorAccess } from "@/lib/growth/access"
import { submitOperatorAutonomousOutboundScopeActivation } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-operator-activation-service"
import {
  GROWTH_AUTONOMOUS_OUTBOUND_DUAL_APPROVAL_WARNING,
  GROWTH_AUTONOMOUS_OUTBOUND_OPERATOR_ACTIVATION_RULE,
  GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ scopeId: string }> }

function activationErrorStatus(error: string | null): number {
  switch (error) {
    case "schema_not_ready":
      return 503
    case "scope_not_found":
      return 404
    case "organization_scope_mismatch":
      return 403
    default:
      return 403
  }
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthOperatorAccess(request)
  if (!access.ok) return access.response

  const { scopeId } = await context.params
  if (!scopeId?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
        error: "scope_id_required",
        message: "Scope id is required.",
      },
      { status: 400 },
    )
  }

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
        error: "growth_engine_ai_org_not_configured",
        message: "Growth Engine AI organization is not configured.",
      },
      { status: 503 },
    )
  }

  try {
    const result = await submitOperatorAutonomousOutboundScopeActivation(access.admin, {
      organizationId,
      scopeId: scopeId.trim(),
      operatorUserId: access.userId,
    })

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          qaMarker: result.qaMarker,
          rule: result.rule,
          error: result.error,
          message: result.message,
          validation: result.validation,
          dualApprovalWarning: GROWTH_AUTONOMOUS_OUTBOUND_DUAL_APPROVAL_WARNING,
          sequenceJobApprovalRequired: true,
          sendOccurred: false,
        },
        { status: activationErrorStatus(result.error) },
      )
    }

    return NextResponse.json({
      ok: true,
      qaMarker: result.qaMarker,
      rule: GROWTH_AUTONOMOUS_OUTBOUND_OPERATOR_ACTIVATION_RULE,
      scope: result.scope,
      validation: result.validation,
      dualApprovalWarning: result.dualApprovalWarning,
      sequenceJobApprovalRequired: true,
      sendOccurred: false,
      activatedByUserId: access.userId,
      planningOnly: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "activation_failed"
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
        error: "activation_failed",
        message,
        sendOccurred: false,
      },
      { status: 500 },
    )
  }
}
