import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { applyCommandCenterUnificationAction } from "@/lib/growth/command-center-unification/command-center-unification-service"
import {
  COMMAND_CENTER_UNIFICATION_ACTIONS,
  type GrowthCommandCenterLeadWorkspace,
  type GrowthCommandCenterWorkspace,
} from "@/lib/growth/command-center-unification/command-center-unification-types"

export const runtime = "nodejs"
export const maxDuration = 120

const ActionSchema = z.object({
  action: z.enum(COMMAND_CENTER_UNIFICATION_ACTIONS),
  workspace: z.custom<GrowthCommandCenterWorkspace | GrowthCommandCenterLeadWorkspace>(),
  navigation_target: z.string().max(500).optional().nullable(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = ActionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await applyCommandCenterUnificationAction(access.admin, {
      action: parsed.data.action,
      workspace: parsed.data.workspace,
      navigation_target: parsed.data.navigation_target,
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
    return NextResponse.json({ ok: false, error: "command_center_unification_action_failed", message }, { status: 500 })
  }
}
