import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { evaluateAutonomousExecutionGuardrailsForLead } from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-resolver"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const leadId = url.searchParams.get("leadId")?.trim()
  if (!leadId) {
    return NextResponse.json({ ok: false, error: "leadId_required" }, { status: 400 })
  }

  const result = await evaluateAutonomousExecutionGuardrailsForLead(access.admin, {
    leadId,
    correlationId: url.searchParams.get("correlationId")?.trim() || undefined,
  })

  return NextResponse.json({
    ok: true,
    enabled: result.enabled,
    decision: result.decision,
    display: result.display,
  })
}
