import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchHumanInterventions } from "@/lib/growth/human-interventions/human-intervention-service"
import { HUMAN_INTERVENTION_FILTERS } from "@/lib/growth/human-interventions/human-intervention-types"

export const runtime = "nodejs"
export const maxDuration = 120

const QuerySchema = z.object({
  lead_id: z.string().max(120).optional(),
  filter: z.enum(HUMAN_INTERVENTION_FILTERS).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  include_campaign_readiness: z.coerce.boolean().optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const queue = await fetchHumanInterventions(access.admin, {
      ...parsed.data,
      persist_audit: false,
    })
    return NextResponse.json({
      ok: true,
      ...queue,
      outreach_enabled: false,
      enrollment_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "human_interventions_failed", message }, { status: 500 })
  }
}
