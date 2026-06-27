import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthOperatorAccess } from "@/lib/growth/access"
import { rejectAdaptiveCalibrationProposal } from "@/lib/growth/aios/learning/growth-adaptive-calibration-service"
import {
  GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
  GROWTH_ADAPTIVE_CALIBRATION_RULE,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

function mutationErrorStatus(error: string | null): number {
  switch (error) {
    case "schema_not_ready":
      return 503
    case "proposal_not_found":
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
        qaMarker: GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
        error: "proposal_id_required",
        message: "Calibration proposal id is required.",
      },
      { status: 400 },
    )
  }

  let rejectionReason: string | undefined
  try {
    const body = (await request.json()) as { rejectionReason?: string }
    rejectionReason = body.rejectionReason?.trim() || undefined
  } catch {
    rejectionReason = undefined
  }

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
        error: "growth_engine_ai_org_not_configured",
        message: "Growth Engine AI organization is not configured.",
      },
      { status: 503 },
    )
  }

  const result = await rejectAdaptiveCalibrationProposal(access.admin, {
    organizationId,
    proposalId: id.trim(),
    operatorUserId: access.userId,
    occurredAt: new Date().toISOString(),
    rejectionReason,
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
        rule: GROWTH_ADAPTIVE_CALIBRATION_RULE,
        error: result.error,
        message: result.message,
        applied: false,
      },
      { status: mutationErrorStatus(result.error) },
    )
  }

  return NextResponse.json({
    ok: true,
    qaMarker: GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
    rule: GROWTH_ADAPTIVE_CALIBRATION_RULE,
    proposal: result.proposal,
    rejectedByUserId: access.userId,
    applied: false,
    noAutoApply: true,
  })
}
