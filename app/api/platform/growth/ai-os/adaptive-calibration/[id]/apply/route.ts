import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthOperatorAccess } from "@/lib/growth/access"
import { applyApprovedCalibrationProposal } from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-service"
import {
  GROWTH_CALIBRATION_APPLY_QA_MARKER,
  GROWTH_CALIBRATION_APPLY_RULE,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

function mutationErrorStatus(error: string | null): number {
  switch (error) {
    case "schema_not_ready":
      return 503
    case "proposal_not_found":
    case "version_not_found":
      return 404
    case "invalid_transition":
    case "proposal_not_approved":
    case "target_not_allowed":
    case "proposal_not_applicable":
    case "guardrail_failed":
      return 409
    default:
      return 403
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireGrowthOperatorAccess(_request)
  if (!access.ok) return access.response

  const { id } = await context.params
  if (!id?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_CALIBRATION_APPLY_QA_MARKER,
        error: "proposal_id_required",
        message: "Calibration proposal id is required.",
      },
      { status: 400 },
    )
  }

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_CALIBRATION_APPLY_QA_MARKER,
        error: "growth_engine_ai_org_not_configured",
        message: "Growth Engine AI organization is not configured.",
      },
      { status: 503 },
    )
  }

  const result = await applyApprovedCalibrationProposal(access.admin, {
    organizationId,
    proposalId: id.trim(),
    operatorUserId: access.userId,
    occurredAt: new Date().toISOString(),
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_CALIBRATION_APPLY_QA_MARKER,
        rule: GROWTH_CALIBRATION_APPLY_RULE,
        error: result.error,
        message: result.message,
        configMutated: false,
        outboundExecuted: false,
      },
      { status: mutationErrorStatus(result.error) },
    )
  }

  return NextResponse.json({
    ok: true,
    qaMarker: GROWTH_CALIBRATION_APPLY_QA_MARKER,
    rule: GROWTH_CALIBRATION_APPLY_RULE,
    version: result.version,
    proposal: result.proposal,
    rollbackToken: result.rollbackToken,
    appliedByUserId: access.userId,
    configMutated: true,
    autonomyMutated: false,
    coreMutated: false,
    outboundExecuted: false,
  })
}
