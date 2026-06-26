import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildGrowthLeadResearchExecutionRuntimeReadModel } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-service"
import { GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()

  try {
    const executionRuntime = await buildGrowthLeadResearchExecutionRuntimeReadModel(access.admin, {
      organizationId,
    })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
      executionRuntime,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
        error: detail,
        message: "Could not load execution runtime.",
      },
      { status: 500 },
    )
  }
}
