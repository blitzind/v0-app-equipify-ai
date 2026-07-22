import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildDraftFactoryWakeDiagnosticTimeline } from "@/lib/growth/draft-factory/draft-factory-wake-observability-diagnostics"
import { GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER } from "@/lib/growth/draft-factory/draft-factory-wake-observability-types"

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
        qaMarker: GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER,
        error: "growth_engine_ai_org_not_configured",
        message: "Growth Engine AI organization is not configured for this deployment.",
      },
      { status: 503 },
    )
  }

  const url = new URL(request.url)
  const eventId = url.searchParams.get("eventId")?.trim()
  const leadId = url.searchParams.get("leadId")?.trim() || null

  if (!eventId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER,
        error: "event_id_required",
        message: "Query parameter eventId is required.",
      },
      { status: 400 },
    )
  }

  try {
    const timeline = await buildDraftFactoryWakeDiagnosticTimeline(access.admin, {
      organizationId,
      eventId,
      leadId,
    })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER,
      timeline,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER,
        error: detail,
        message: "Could not load Draft Factory wake diagnostics.",
      },
      { status: 500 },
    )
  }
}
