import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { applyCampaignBuilderAction } from "@/lib/growth/campaign-builder/campaign-builder-service"
import {
  CAMPAIGN_BUILDER_ACTIONS,
  type CampaignBuilderWizard,
} from "@/lib/growth/campaign-builder/campaign-builder-types"

export const runtime = "nodejs"
export const maxDuration = 120

const ActionSchema = z.object({
  action: z.enum(CAMPAIGN_BUILDER_ACTIONS),
  wizard: z.custom<CampaignBuilderWizard>(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = ActionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await applyCampaignBuilderAction(access.admin, {
      action: parsed.data.action,
      wizard: parsed.data.wizard,
      operator_id: access.userId,
    })
    return NextResponse.json({
      ok: result.ok,
      error: result.error ?? null,
      outreach_execution: false,
      enrollment_execution: false,
      auto_reply: false,
      requires_human_review: true,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "campaign_builder_action_failed", message }, { status: 500 })
  }
}
