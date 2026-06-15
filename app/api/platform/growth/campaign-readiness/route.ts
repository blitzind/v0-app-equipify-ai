import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadCampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-service"
import {
  CAMPAIGN_READINESS_SUBJECT_TYPES,
} from "@/lib/growth/campaign-readiness/campaign-readiness-types"

export const runtime = "nodejs"
export const maxDuration = 120

const QuerySchema = z.object({
  lead_id: z.string().max(120).optional(),
  execution_run_id: z.string().max(120).optional(),
  search_plan_id: z.string().max(120).optional(),
  subject_type: z.enum(CAMPAIGN_READINESS_SUBJECT_TYPES).optional(),
  subject_ref: z.string().max(200).optional(),
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
    const result = await loadCampaignReadinessAssessment(access.admin, parsed.data)
    if (!result.ok || !result.assessment) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "assessment_failed" },
        { status: 422 },
      )
    }

    return NextResponse.json({
      ok: true,
      assessment: result.assessment,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      outreach_enabled: false,
      enrollment_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "campaign_readiness_failed", message }, { status: 500 })
  }
}
