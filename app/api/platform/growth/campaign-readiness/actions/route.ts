import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { markCampaignReadinessReviewed } from "@/lib/growth/campaign-readiness/campaign-readiness-service"
import {
  CAMPAIGN_READINESS_ACTIONS,
  type CampaignReadinessAssessment,
} from "@/lib/growth/campaign-readiness/campaign-readiness-types"

export const runtime = "nodejs"
export const maxDuration = 120

const ActionSchema = z.object({
  action: z.enum(CAMPAIGN_READINESS_ACTIONS),
  assessment_id: z.string().max(200),
  assessment: z.custom<CampaignReadinessAssessment>(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = ActionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    if (parsed.data.action === "mark_reviewed") {
      const result = await markCampaignReadinessReviewed(access.admin, {
        assessment_id: parsed.data.assessment_id,
        assessment: parsed.data.assessment,
        operator_id: access.userId,
      })
      return NextResponse.json({
        ok: result.ok,
        error: result.error ?? null,
        outreach_execution: false,
        enrollment_execution: false,
        requires_human_review: true,
        autonomous_execution_enabled: false,
      })
    }

    return NextResponse.json({
      ok: true,
      outreach_execution: false,
      enrollment_execution: false,
      requires_human_review: true,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "campaign_readiness_action_failed", message }, { status: 500 })
  }
}
