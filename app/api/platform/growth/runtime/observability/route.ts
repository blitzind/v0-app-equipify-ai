import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { getGrowthRuntimeObservabilitySnapshot } from "@/lib/growth/runtime-guardrails/growth-runtime-observability-service"
import { GROWTH_RUNTIME_GUARDRAILS_QA_MARKER } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

export const runtime = "nodejs"

/** Read-only runtime guardrails observability — never 500 on missing schema. */
export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId() ?? undefined
  const snapshot = await getGrowthRuntimeObservabilitySnapshot(access.admin, {
    organizationId,
    userId: access.userId,
  })

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
    read_only: true,
    status: snapshot.status,
    snapshot,
  })
}
