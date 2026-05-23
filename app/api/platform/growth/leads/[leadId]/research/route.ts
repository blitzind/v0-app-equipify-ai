import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { loadGrowthLeadResearchBundle } from "@/lib/growth/research-repository"
import { runGrowthLeadResearch } from "@/lib/growth/run-lead-research"

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

    const bundle = await loadGrowthLeadResearchBundle(access.admin, leadId)
    return NextResponse.json({
      ok: true,
      leadId,
      latestRun: bundle.latestRun,
      runs: bundle.runs,
      manualNotes: bundle.manualNotes,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "query_failed", message }, { status: 500 })
  }
}

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

  try {
    const result = await runGrowthLeadResearch({
      admin: access.admin,
      leadId,
      createdBy: access.userId,
      actingUserEmail: access.userEmail,
      regenerate: parsed.success ? parsed.data.regenerate : false,
    })

    if (!result.ok) {
      const status =
        result.code === "not_found" ? 404
        : result.code === "not_configured" || result.code === "server_config" ? 503
        : 500

      logGrowthEngine("research_api_failed", {
        leadId,
        code: result.code,
        actorEmail: access.userEmail,
      })

      return NextResponse.json(
        {
          ok: false,
          error: result.code,
          message: result.message,
          run: result.run ?? null,
        },
        { status },
      )
    }

    logGrowthEngine("research_api_success", {
      leadId,
      runId: result.run.id,
      cached: result.cached,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({
      ok: true,
      run: result.run,
      leadStatus: result.leadStatus,
      leadScore: result.leadScore,
      cached: result.cached,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logGrowthEngine("research_api_exception", {
      leadId,
      message: message.slice(0, 240),
      actorEmail: access.userEmail,
    })
    return NextResponse.json(
      {
        ok: false,
        error: "research_failed",
        message: message.slice(0, 240),
        run: null,
      },
      { status: 500 },
    )
  }
}
