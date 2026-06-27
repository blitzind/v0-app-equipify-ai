import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchAiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-service"
import { GROWTH_PRIORITY_ENGINE_BINDING_QA_MARKER } from "@/lib/growth/aios/priority/growth-priority-engine-binding-types"

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
        qaMarker: GROWTH_PRIORITY_ENGINE_BINDING_QA_MARKER,
        error: "growth_engine_ai_org_not_configured",
        message: "Growth Engine AI organization is not configured for this deployment.",
      },
      { status: 503 },
    )
  }

  const url = new URL(request.url)
  const objectiveId = url.searchParams.get("objectiveId")

  try {
    const commandCenter = await fetchAiOsCommandCenterReadModel(access.admin, { organizationId })
    const priorityBinding = commandCenter.priorityBinding
    const objectiveContext = objectiveId
      ? priorityBinding.objectiveContexts.find((row) => row.objectiveId === objectiveId) ?? null
      : null

    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_PRIORITY_ENGINE_BINDING_QA_MARKER,
      priorityBinding,
      objectiveContext,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_PRIORITY_ENGINE_BINDING_QA_MARKER,
        error: detail,
        message: "Could not load Priority Engine bindings.",
      },
      { status: 500 },
    )
  }
}
