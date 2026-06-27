import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchAiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-service"
import { GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"

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
        qaMarker: GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
        error: "growth_engine_ai_org_not_configured",
      },
      { status: 503 },
    )
  }

  try {
    const commandCenter = await fetchAiOsCommandCenterReadModel(access.admin, { organizationId })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
      boundedAutonomousOutbound: commandCenter.boundedAutonomousOutbound,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
        error: error instanceof Error ? error.message : "bounded_autonomous_outbound_read_failed",
      },
      { status: 500 },
    )
  }
}
