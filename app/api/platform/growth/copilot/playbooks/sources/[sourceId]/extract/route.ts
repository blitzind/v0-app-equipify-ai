import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { runGrowthAiCopilotPlaybookExtraction } from "@/lib/growth/run-ai-copilot-playbook-extraction"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ sourceId: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { sourceId } = await context.params

  const result = await runGrowthAiCopilotPlaybookExtraction({
    admin: access.admin,
    sourceId,
    actingUserId: access.userId,
  })

  if (!result.ok) {
    const status = result.code === "ai_not_configured" ? 503 : 400
    return NextResponse.json(result, { status })
  }

  return NextResponse.json({ ok: true, ...result })
}
