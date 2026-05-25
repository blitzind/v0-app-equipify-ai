import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadCallIntelligenceForLead } from "@/lib/growth/call-intelligence/call-intelligence-service"
import { GROWTH_TRUE_CALL_INTELLIGENCE_QA_MARKER } from "@/lib/growth/call-intelligence/call-intelligence-types"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid lead id." }, { status: 400 })
  }

  try {
    const { latestScorecard } = await loadCallIntelligenceForLead(access.admin, leadId)
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_TRUE_CALL_INTELLIGENCE_QA_MARKER,
      leadId,
      scorecard: latestScorecard,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load call intelligence."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
