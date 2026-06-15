import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { applyHumanInterventionAction } from "@/lib/growth/human-interventions/human-intervention-service"
import {
  HUMAN_INTERVENTION_ACTIONS,
  type HumanIntervention,
} from "@/lib/growth/human-interventions/human-intervention-types"

export const runtime = "nodejs"
export const maxDuration = 120

const ActionSchema = z.object({
  action: z.enum(HUMAN_INTERVENTION_ACTIONS),
  intervention: z.custom<HumanIntervention>(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = ActionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await applyHumanInterventionAction(access.admin, {
      action: parsed.data.action,
      intervention: parsed.data.intervention,
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
    return NextResponse.json({ ok: false, error: "human_intervention_action_failed", message }, { status: 500 })
  }
}
