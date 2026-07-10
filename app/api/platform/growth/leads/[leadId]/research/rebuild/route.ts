import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { routeCanonicalProspectResearch } from "@/lib/growth/research/growth-canonical-research-route"
import { GROWTH_CANONICAL_RESEARCH_23_QA_MARKER } from "@/lib/growth/research/growth-canonical-research-types"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "invalid_lead_id", message: "Lead id must be a UUID." }, { status: 400 })
  }

  const lead = await fetchGrowthLeadById(access.admin, leadId)
  if (!lead) {
    return NextResponse.json({ error: "not_found", message: "Lead not found." }, { status: 404 })
  }

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, error: "server_config", message: "Prospect research is not configured." },
      { status: 503 },
    )
  }

  try {
    const result = await routeCanonicalProspectResearch({
      admin: access.admin,
      organizationId,
      leadId,
      trigger: "manual",
      rebuild: true,
      force: true,
      runQualification: true,
    })

    if (!result.ok) {
      const status =
        result.code === "not_found" ? 404
        : result.code === "server_config" || result.outcome === "not_configured" ? 503
        : result.outcome === "skipped" ? 409
        : 500
      logGrowthEngine("prospect_research_rebuild_failed", { leadId, code: result.code, qaMarker: GROWTH_CANONICAL_RESEARCH_23_QA_MARKER })
      return NextResponse.json(
        { ok: false, error: result.code, message: result.message, run: result.run ?? null, qaMarker: GROWTH_CANONICAL_RESEARCH_23_QA_MARKER },
        { status },
      )
    }

    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_CANONICAL_RESEARCH_23_QA_MARKER,
      run: result.run,
      lead: result.lead ?? null,
      cached: result.outcome === "cached" || result.outcome === "active",
      rebuilt: true,
      qualificationRan: result.qualificationRan,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "research_failed", message: message.slice(0, 240) }, { status: 500 })
  }
}
