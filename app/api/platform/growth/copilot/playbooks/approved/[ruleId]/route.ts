import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { disableGrowthAiCopilotPlaybookApprovedRule } from "@/lib/growth/ai-copilot-playbook-repository"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ ruleId: string }> }

export async function PATCH(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { ruleId } = await context.params

  try {
    const approvedRule = await disableGrowthAiCopilotPlaybookApprovedRule(access.admin, ruleId)
    return NextResponse.json({ ok: true, approvedRule })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
