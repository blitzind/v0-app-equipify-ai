import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_BROWSER_INTAKE_BUYING_COMMITTEE_QA_MARKER } from "@/lib/growth/browser-intake/browser-intake-buying-committee-types"
import { discoverBrowserIntakeBuyingCommittee } from "@/lib/growth/browser-intake/discover-browser-intake-buying-committee"

export const runtime = "nodejs"

const VisibleCandidateSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  job_title: z.string().trim().max(200).optional().nullable(),
  linkedin_url: z.string().trim().max(500).optional().nullable(),
  email: z.string().trim().email().max(320).optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(40).optional().nullable(),
  source: z.string().trim().max(120).optional().nullable(),
})

const DiscoverSchema = z.object({
  lead_id: z.string().uuid().optional().nullable(),
  company_name: z.string().trim().max(200).optional().nullable(),
  website: z.string().trim().max(500).optional().nullable(),
  linkedin_url: z.string().trim().max(500).optional().nullable(),
  source_url: z.string().trim().max(2000).optional().nullable(),
  visible_candidates: z.array(VisibleCandidateSchema).max(30).optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const rawBody = await request.json().catch(() => null)
  const parsed = DiscoverSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", message: "Invalid buying committee discovery payload." },
      { status: 400 },
    )
  }

  const body = parsed.data
  if (!body.lead_id && !body.company_name?.trim()) {
    return NextResponse.json(
      { error: "invalid_query", message: "Provide lead_id or company_name." },
      { status: 400 },
    )
  }

  try {
    const discovery = await discoverBrowserIntakeBuyingCommittee(access.admin, {
      lead_id: body.lead_id,
      company_name: body.company_name,
      website: body.website,
      linkedin_url: body.linkedin_url,
      source_url: body.source_url,
      visible_candidates: body.visible_candidates?.map((row) => ({
        ...row,
        email: row.email?.trim() ? row.email.trim().toLowerCase() : null,
      })),
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_BROWSER_INTAKE_BUYING_COMMITTEE_QA_MARKER,
      discovery,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message === "company_name_required" ? 400 : 500
    return NextResponse.json({ error: "buying_committee_discover_failed", message }, { status })
  }
}
