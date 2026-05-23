import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listGrowthAiCopilotPlaybookDraftRules } from "@/lib/growth/ai-copilot-playbook-repository"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const draftRules = await listGrowthAiCopilotPlaybookDraftRules(access.admin, { status: "draft", limit: 100 })
    return NextResponse.json({ ok: true, draftRules })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
