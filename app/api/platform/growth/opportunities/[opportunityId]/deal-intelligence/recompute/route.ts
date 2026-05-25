import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { recomputeDealIntelligenceScore } from "@/lib/growth/deal-intelligence/deal-intelligence-service"
import { fetchGrowthOpportunityDetail } from "@/lib/growth/opportunity-pipeline/pipeline-repository"
import { GROWTH_PREDICTIVE_DEAL_INTELLIGENCE_QA_MARKER } from "@/lib/growth/deal-intelligence/deal-intelligence-types"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ opportunityId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { opportunityId } = await context.params
  if (!z.string().uuid().safeParse(opportunityId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid opportunity id." }, { status: 400 })
  }

  try {
    const opportunity = await fetchGrowthOpportunityDetail(access.admin, opportunityId)
    if (!opportunity) {
      return NextResponse.json({ error: "not_found", message: "Opportunity not found." }, { status: 404 })
    }

    const result = await recomputeDealIntelligenceScore({
      admin: access.admin,
      leadId: opportunity.leadId,
      opportunityId,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.code, message: result.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_PREDICTIVE_DEAL_INTELLIGENCE_QA_MARKER,
      score: result.score,
      previousScore: result.previousScore,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not recompute deal intelligence."
    return NextResponse.json({ error: "recompute_failed", message }, { status: 500 })
  }
}
