import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { runProspectResearch } from "@/lib/growth/research/research-orchestrator"

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

  try {
    const result = await runProspectResearch({
      admin: access.admin,
      leadId,
      rebuild: false,
    })

    if (!result.ok) {
      const status = result.code === "not_found" ? 404 : result.code === "server_config" ? 503 : 500
      logGrowthEngine("prospect_research_api_failed", { leadId, code: result.code })
      return NextResponse.json(
        { ok: false, error: result.code, message: result.message, run: result.run ?? null },
        { status },
      )
    }

    return NextResponse.json({
      ok: true,
      run: result.run,
      lead: result.lead ?? null,
      cached: result.cached,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "research_failed", message: message.slice(0, 240) }, { status: 500 })
  }
}
