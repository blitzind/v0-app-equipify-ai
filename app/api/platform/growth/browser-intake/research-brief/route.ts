import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_BROWSER_INTAKE_RESEARCH_BRIEF_QA_MARKER } from "@/lib/growth/browser-intake/browser-intake-research-brief-types"
import { buildBrowserIntakeResearchBrief } from "@/lib/growth/browser-intake/build-browser-intake-research-brief"

export const runtime = "nodejs"

const ResearchBriefSchema = z.object({
  lead_id: z.string().uuid().optional().nullable(),
  company_name: z.string().trim().max(200).optional().nullable(),
  website: z.string().trim().max(500).optional().nullable(),
  linkedin_url: z.string().trim().max(500).optional().nullable(),
  email: z.string().trim().email().max(320).optional().nullable().or(z.literal("")),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const rawBody = await request.json().catch(() => null)
  const parsed = ResearchBriefSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", message: "Invalid research brief payload." },
      { status: 400 },
    )
  }

  const body = parsed.data
  const email = body.email?.trim() ? body.email.trim().toLowerCase() : null

  if (!body.lead_id && !body.company_name && !body.website && !body.linkedin_url && !email) {
    return NextResponse.json(
      { error: "invalid_query", message: "Provide lead_id or lookup fields." },
      { status: 400 },
    )
  }

  try {
    const result = await buildBrowserIntakeResearchBrief(access.admin, {
      lead_id: body.lead_id,
      company_name: body.company_name,
      website: body.website,
      linkedin_url: body.linkedin_url,
      email,
    })

    return NextResponse.json({
      ok: result.matched,
      qa_marker: GROWTH_BROWSER_INTAKE_RESEARCH_BRIEF_QA_MARKER,
      matched: result.matched,
      artifact: result.artifact,
      message: result.message ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: "research_brief_failed", message }, { status: 500 })
  }
}
