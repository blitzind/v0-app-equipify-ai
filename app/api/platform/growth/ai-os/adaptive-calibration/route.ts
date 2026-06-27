import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthAdaptiveCalibrationReadModel } from "@/lib/growth/aios/learning/growth-adaptive-calibration-service"
import {
  GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
  GROWTH_ADAPTIVE_CALIBRATION_RULE,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
        error: "growth_engine_ai_org_not_configured",
        message: "Growth Engine AI organization is not configured for this deployment.",
      },
      { status: 503 },
    )
  }

  try {
    const adaptiveCalibration = await fetchGrowthAdaptiveCalibrationReadModel(access.admin, {
      organizationId,
      generatedAt: new Date().toISOString(),
    })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
      rule: GROWTH_ADAPTIVE_CALIBRATION_RULE,
      adaptiveCalibration,
      applied: false,
      noAutoApply: true,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
        error: detail,
        message: "Could not load adaptive calibration proposals.",
      },
      { status: 500 },
    )
  }
}
