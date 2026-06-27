import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchAiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-service"
import { GROWTH_COMMUNICATION_ENGINE_QA_MARKER } from "@/lib/growth/aios/communication/growth-communication-engine-types"
import { requestGrowthCommunicationPlan } from "@/lib/growth/aios/communication/growth-communication-engine-service"
import type { GrowthCommunicationSubjectType } from "@/lib/growth/aios/communication/growth-communication-engine-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SUBJECT_TYPES = new Set<GrowthCommunicationSubjectType>([
  "lead",
  "company",
  "person",
  "customer",
  "objective",
  "mission",
  "campaign",
  "sequence",
])

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_COMMUNICATION_ENGINE_QA_MARKER,
        error: "growth_engine_ai_org_not_configured",
        message: "Growth Engine AI organization is not configured for this deployment.",
      },
      { status: 503 },
    )
  }

  const url = new URL(request.url)
  const subjectType = url.searchParams.get("subjectType") as GrowthCommunicationSubjectType | null
  const subjectId = url.searchParams.get("subjectId")

  try {
    if (subjectType && subjectId && SUBJECT_TYPES.has(subjectType)) {
      const plan = requestGrowthCommunicationPlan({
        organizationId,
        subject: { type: subjectType, id: subjectId },
        generatedAt: new Date().toISOString(),
      })
      return NextResponse.json({
        ok: true,
        qaMarker: GROWTH_COMMUNICATION_ENGINE_QA_MARKER,
        plan,
      })
    }

    const commandCenter = await fetchAiOsCommandCenterReadModel(access.admin, { organizationId })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_COMMUNICATION_ENGINE_QA_MARKER,
      communicationEngine: commandCenter.communicationEngine,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_COMMUNICATION_ENGINE_QA_MARKER,
        error: detail,
        message: "Could not load Communication Engine plan.",
      },
      { status: 500 },
    )
  }
}
