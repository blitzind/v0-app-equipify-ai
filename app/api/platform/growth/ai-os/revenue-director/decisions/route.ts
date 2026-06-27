import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildRevenueDirectorDecisionLedgerReadModel } from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-service"
import { GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER } from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-types"

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
        qaMarker: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
        error: "growth_engine_ai_org_not_configured",
        message: "Growth Engine AI organization is not configured.",
      },
      { status: 503 },
    )
  }

  try {
    const ledger = await buildRevenueDirectorDecisionLedgerReadModel(access.admin, {
      organizationId,
      generatedAt: new Date().toISOString(),
    })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
      decisionLedger: ledger,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
        error: detail,
        message: "Could not load Revenue Director decision ledger.",
      },
      { status: 500 },
    )
  }
}
