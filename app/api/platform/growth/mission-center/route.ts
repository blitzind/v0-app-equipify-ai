import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_AVA_MISSION_CENTER_1A_QA_MARKER } from "@/lib/growth/mission-center/growth-mission-center-types"
import { loadGrowthMissionCenterSources } from "@/lib/growth/mission-center/growth-mission-center-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GE-AVA-MISSION-CENTER-1A — Read-only mission source aggregation (no new runtime). */
export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AVA_MISSION_CENTER_1A_QA_MARKER,
        message: "Growth Engine AI organization is not configured for this deployment.",
      },
      { status: 503 },
    )
  }

  try {
    const payload = await loadGrowthMissionCenterSources(access.admin, organizationId)
    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load mission center sources."
    return NextResponse.json(
      { ok: false, qaMarker: GROWTH_AVA_MISSION_CENTER_1A_QA_MARKER, message },
      { status: 500 },
    )
  }
}
