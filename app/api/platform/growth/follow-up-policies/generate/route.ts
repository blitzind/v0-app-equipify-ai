import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchSmartFollowUpPolicies } from "@/lib/growth/follow-up-policies/follow-up-policy-service"
import { SMART_FOLLOW_UP_FILTERS } from "@/lib/growth/follow-up-policies/follow-up-policy-types"

export const runtime = "nodejs"
export const maxDuration = 120

const BodySchema = z.object({
  lead_id: z.string().max(120).optional().nullable(),
  filter: z.enum(SMART_FOLLOW_UP_FILTERS).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  include_campaign_readiness: z.boolean().optional(),
  include_interventions: z.boolean().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const queue = await fetchSmartFollowUpPolicies(access.admin, {
      ...parsed.data,
      persist_audit: true,
    })
    return NextResponse.json({
      ok: true,
      ...queue,
      outreach_enabled: false,
      enrollment_enabled: false,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "follow_up_policy_generate_failed", message }, { status: 500 })
  }
}
