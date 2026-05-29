import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { runCapturedLeadAction } from "@/lib/growth/captured-leads/captured-lead-actions"
import {
  GROWTH_CAPTURED_LEAD_ACTIONS,
  GROWTH_CAPTURED_LEADS_QA_MARKER,
} from "@/lib/growth/captured-leads/captured-lead-types"

export const runtime = "nodejs"

const ActionSchema = z.object({
  action: z.enum(GROWTH_CAPTURED_LEAD_ACTIONS),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  const parsed = ActionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid action." }, { status: 400 })
  }

  try {
    const result = await runCapturedLeadAction(access.admin, {
      leadId,
      action: parsed.data.action,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })

    logGrowthEngine("captured_leads_api_action", {
      leadId,
      action: parsed.data.action,
      ok: result.ok,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({
      ok: result.ok,
      qa_marker: GROWTH_CAPTURED_LEADS_QA_MARKER,
      result,
    }, { status: result.ok ? 200 : 409 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "action_failed", message }, { status: 500 })
  }
}
