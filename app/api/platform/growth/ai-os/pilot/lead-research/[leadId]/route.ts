import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchLeadResearchPilotObservation } from "@/lib/growth/aios/pilot/lead-research-pilot-observability"
import { GROWTH_AI_OS_LEAD_RESEARCH_PILOT_QA_MARKER } from "@/lib/growth/aios/pilot/lead-research-pilot-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ leadId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  const organizationId = getGrowthEngineAiOrgId()

  try {
    const observation = await fetchLeadResearchPilotObservation(access.admin, {
      organizationId,
      leadId,
    })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_AI_OS_LEAD_RESEARCH_PILOT_QA_MARKER,
      observation,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AI_OS_LEAD_RESEARCH_PILOT_QA_MARKER,
        error: detail,
        message: "Could not load Lead Research Pilot observation.",
      },
      { status: 500 },
    )
  }
}
