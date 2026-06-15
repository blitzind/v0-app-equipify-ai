import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchHumanInterventions } from "@/lib/growth/human-interventions/human-intervention-service"
import { HUMAN_INTERVENTION_FILTERS } from "@/lib/growth/human-interventions/human-intervention-types"

export const runtime = "nodejs"
export const maxDuration = 120

const GenerateSchema = z.object({
  lead_id: z.string().max(120).optional(),
  filter: z.enum(HUMAN_INTERVENTION_FILTERS).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  include_campaign_readiness: z.boolean().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = GenerateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const queue = await fetchHumanInterventions(access.admin, {
      ...parsed.data,
      persist_audit: true,
    })
    return NextResponse.json({
      ok: true,
      ...queue,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      outreach_enabled: false,
      enrollment_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "generate_failed", message }, { status: 500 })
  }
}
