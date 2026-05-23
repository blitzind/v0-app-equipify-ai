import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listGrowthAiCopilotPlaybookApprovedRules } from "@/lib/growth/ai-copilot-playbook-repository"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const approvedRules = await listGrowthAiCopilotPlaybookApprovedRules(access.admin, 200)
    return NextResponse.json({ ok: true, approvedRules })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
