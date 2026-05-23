import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listGrowthAiCopilotGenerationsForLead } from "@/lib/growth/ai-copilot-repository"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!UUID_RE.test(leadId)) {
    return NextResponse.json({ error: "invalid_lead", message: "Invalid lead id." }, { status: 400 })
  }

  try {
    const generations = await listGrowthAiCopilotGenerationsForLead(access.admin, leadId, 20)
    return NextResponse.json({ ok: true, generations })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
