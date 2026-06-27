import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchAiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-service"
import { GROWTH_REVENUE_DIRECTOR_QA_MARKER } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"

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
        qaMarker: GROWTH_REVENUE_DIRECTOR_QA_MARKER,
        error: "growth_engine_ai_org_not_configured",
        message: "Growth Engine AI organization is not configured for this deployment.",
      },
      { status: 503 },
    )
  }

  try {
    const commandCenter = await fetchAiOsCommandCenterReadModel(access.admin, { organizationId })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_REVENUE_DIRECTOR_QA_MARKER,
      revenueDirector: commandCenter.revenueDirector,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_REVENUE_DIRECTOR_QA_MARKER,
        error: detail,
        message: "Could not load Revenue Director orchestration snapshot.",
      },
      { status: 500 },
    )
  }
}
