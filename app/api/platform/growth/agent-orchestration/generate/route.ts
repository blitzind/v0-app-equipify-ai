import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthAgentOrchestration } from "@/lib/growth/agent-orchestration/agent-orchestration-service"
import { AGENT_ORCHESTRATION_FILTERS } from "@/lib/growth/agent-orchestration/agent-orchestration-types"
import { guardGrowthFeatureApiRoute } from "@/lib/growth/runtime/growth-feature-api-guards"

export const runtime = "nodejs"
export const maxDuration = 120

const BodySchema = z.object({
  lead_id: z.string().max(120).optional().nullable(),
  pattern_id: z.string().max(120).optional().nullable(),
  filter: z.enum(AGENT_ORCHESTRATION_FILTERS).optional(),
  limit: z.number().int().min(1).max(25).optional(),
  include_campaign_readiness: z.boolean().optional(),
})

export async function POST(request: Request) {
  const coldGuard = await guardGrowthFeatureApiRoute("agentOrchestrationDashboard", request)
  if (coldGuard) return coldGuard
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const orchestration = await fetchGrowthAgentOrchestration(access.admin, {
      ...parsed.data,
      persist_audit: true,
    })
    return NextResponse.json({
      ok: true,
      ...orchestration,
      outreach_execution: false,
      enrollment_execution: false,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "agent_orchestration_generate_failed", message }, { status: 500 })
  }
}
