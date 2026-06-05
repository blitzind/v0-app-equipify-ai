import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { runProspectSearchHumanAcquisitionPipeline } from "@/lib/growth/prospect-search/prospect-search-human-acquisition"
import { GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-human-acquisition-types"

export const runtime = "nodejs"

const BodySchema = z.object({
  company_candidate_id: z.string().uuid(),
  canonical_company_id: z.string().uuid().nullable().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "company_candidate_id (uuid) is required." },
      { status: 400 },
    )
  }

  const result = await runProspectSearchHumanAcquisitionPipeline(access.admin, {
    company_candidate_id: parsed.data.company_candidate_id,
    canonical_company_id: parsed.data.canonical_company_id ?? null,
    created_by: access.userId,
    run_discovery: true,
  })

  return NextResponse.json({
    ok: result.ok,
    qa_marker: GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_QA_MARKER,
    ...result,
  })
}
