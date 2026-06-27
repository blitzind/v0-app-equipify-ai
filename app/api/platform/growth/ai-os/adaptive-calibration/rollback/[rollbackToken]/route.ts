import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthOperatorAccess } from "@/lib/growth/access"
import { rollbackCalibrationVersion } from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-service"
import {
  GROWTH_CALIBRATION_APPLY_QA_MARKER,
  GROWTH_CALIBRATION_APPLY_RULE,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ rollbackToken: string }> }

function mutationErrorStatus(error: string | null): number {
  switch (error) {
    case "schema_not_ready":
      return 503
    case "version_not_found":
      return 404
    case "already_rolled_back":
      return 409
    default:
      return 403
  }
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthOperatorAccess(request)
  if (!access.ok) return access.response

  const { rollbackToken } = await context.params
  if (!rollbackToken?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_CALIBRATION_APPLY_QA_MARKER,
        error: "rollback_token_required",
        message: "Rollback token is required.",
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

  const result = await rollbackCalibrationVersion(access.admin, {
    organizationId,
    rollbackToken: rollbackToken.trim(),
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
      },
      { status: mutationErrorStatus(result.error) },
    )
  }

  return NextResponse.json({
    ok: true,
    qaMarker: GROWTH_CALIBRATION_APPLY_QA_MARKER,
    rule: GROWTH_CALIBRATION_APPLY_RULE,
    version: result.version,
    rollbackToken: result.rollbackToken,
    rolledBackByUserId: access.userId,
    configMutated: true,
    autonomyMutated: false,
    coreMutated: false,
    outboundExecuted: false,
  })
}
