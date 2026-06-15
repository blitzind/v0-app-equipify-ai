import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildAgentOrchestrationReadinessPayload } from "@/lib/growth/agent-orchestration/agent-orchestration-route-gates"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  return NextResponse.json({
    ok: true,
    ...buildAgentOrchestrationReadinessPayload(),
  })
}
