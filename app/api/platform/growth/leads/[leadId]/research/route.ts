import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { loadGrowthLeadResearchBundle } from "@/lib/growth/research-repository"
import { loadProspectIntelligenceBundle } from "@/lib/growth/research/research-repository"
import { mapProspectRunToLegacyResearchRun, projectGrowthLeadResearchBundleReadModel } from "@/lib/growth/research/growth-canonical-research-legacy-adapter"
import { routeCanonicalProspectResearch } from "@/lib/growth/research/growth-canonical-research-route"
import { GROWTH_CANONICAL_RESEARCH_23_QA_MARKER } from "@/lib/growth/research/growth-canonical-research-types"

export const runtime = "nodejs"

const PostSchema = z.object({
  regenerate: z.boolean().optional(),
})

export async function GET(
  _request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "invalid_lead_id", message: "Lead id must be a UUID." }, { status: 400 })
  }

  try {
    const lead = await fetchGrowthLeadById(access.admin, leadId)
    if (!lead) {
      return NextResponse.json({ error: "not_found", message: "Lead not found." }, { status: 404 })
    }

    const [bundle, prospectIntelligence] = await Promise.all([
      loadGrowthLeadResearchBundle(access.admin, leadId),
      loadProspectIntelligenceBundle(access.admin, leadId),
    ])
    const projected = projectGrowthLeadResearchBundleReadModel({
      legacyRuns: bundle.runs,
      legacyLatestRun: bundle.latestRun,
      manualNotes: bundle.manualNotes,
      prospectIntelligence,
    })
    return NextResponse.json({
      ok: true,
      leadId,
      latestRun: projected.latestRun,
      runs: projected.runs,
      manualNotes: projected.manualNotes,
      prospectIntelligence,
      qaMarker: GROWTH_CANONICAL_RESEARCH_23_QA_MARKER,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "query_failed", message }, { status: 500 })
  }
}

/** @deprecated POST — thin wrapper; canonical execution via executeGrowthLeadProspectResearch (GE-AIOS-23). */
export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "invalid_lead_id", message: "Lead id must be a UUID." }, { status: 400 })
  }

  const rawBody = await request.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(rawBody)
  const regenerate = parsed.success ? Boolean(parsed.data.regenerate) : false

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, error: "server_config", message: "Prospect research is not configured." },
      { status: 503 },
    )
  }

  try {
    logGrowthEngine("legacy_research_post_delegated", {
      leadId,
      regenerate,
      qaMarker: GROWTH_CANONICAL_RESEARCH_23_QA_MARKER,
    })

    const result = await routeCanonicalProspectResearch({
      admin: access.admin,
      organizationId,
      leadId,
      trigger: "manual",
      rebuild: regenerate,
      force: regenerate,
      runQualification: true,
    })

    if (!result.ok) {
      const status =
        result.code === "not_found" ? 404
        : result.code === "server_config" || result.outcome === "not_configured" ? 503
        : result.outcome === "skipped" ? 409
        : 500

      return NextResponse.json(
        {
          ok: false,
          error: result.code,
          message: result.message,
          run: result.run ? mapProspectRunToLegacyResearchRun(result.run, { createdBy: access.userId, triggerKind: regenerate ? "regenerate" : "manual" }) : null,
          qaMarker: GROWTH_CANONICAL_RESEARCH_23_QA_MARKER,
        },
        { status },
      )
    }

    const legacyRun = mapProspectRunToLegacyResearchRun(result.run, {
      createdBy: access.userId,
      triggerKind: regenerate ? "regenerate" : "manual",
    })

    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_CANONICAL_RESEARCH_23_QA_MARKER,
      run: legacyRun,
      leadStatus: result.lead?.status ?? null,
      leadScore: result.lead?.score ?? null,
      lead: result.lead ?? null,
      cached: result.outcome === "cached" || result.outcome === "active",
      prospectRun: result.run,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { ok: false, error: "research_failed", message: message.slice(0, 240), run: null },
      { status: 500 },
    )
  }
}
