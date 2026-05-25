import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchGrowthDealIntelligenceDashboard,
  loadDealIntelligenceForLead,
} from "@/lib/growth/deal-intelligence/deal-intelligence-service"
import { GROWTH_PREDICTIVE_DEAL_INTELLIGENCE_QA_MARKER } from "@/lib/growth/deal-intelligence/deal-intelligence-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const leadIdParam = url.searchParams.get("leadId")
  const leadId = leadIdParam && z.string().uuid().safeParse(leadIdParam).success ? leadIdParam : null

  try {
    const dashboard = await fetchGrowthDealIntelligenceDashboard(access.admin)
    const leadScore = leadId ? await loadDealIntelligenceForLead(access.admin, leadId) : null

    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_PREDICTIVE_DEAL_INTELLIGENCE_QA_MARKER,
      dashboard,
      leadScore,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load deal intelligence dashboard."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
