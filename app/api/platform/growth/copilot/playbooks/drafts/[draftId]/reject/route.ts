import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { rejectGrowthAiCopilotPlaybookDraft } from "@/lib/growth/run-ai-copilot-playbook-approval"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ draftId: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { draftId } = await context.params
  const result = await rejectGrowthAiCopilotPlaybookDraft(access.admin, {
    draftId,
    actingUserId: access.userId,
  })

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
