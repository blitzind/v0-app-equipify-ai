import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchCampaignBuilderWizard } from "@/lib/growth/campaign-builder/campaign-builder-service"
import { CAMPAIGN_BUILDER_FILTERS } from "@/lib/growth/campaign-builder/campaign-builder-types"

export const runtime = "nodejs"
export const maxDuration = 120

const BodySchema = z.object({
  lead_id: z.string().max(120).optional().nullable(),
  pattern_id: z.string().max(120).optional().nullable(),
  filter: z.enum(CAMPAIGN_BUILDER_FILTERS).optional(),
  limit: z.number().int().min(1).max(25).optional(),
  include_campaign_readiness: z.boolean().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const studio = await fetchCampaignBuilderWizard(access.admin, {
      ...parsed.data,
      persist_audit: true,
    })
    return NextResponse.json({
      ok: true,
      ...studio,
      outreach_enabled: false,
      enrollment_enabled: false,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "campaign_builder_generate_failed", message }, { status: 500 })
  }
}
