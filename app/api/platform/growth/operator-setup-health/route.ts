import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildGrowthOperatorSetupHealth } from "@/lib/growth/operational/ge-v1-2-operator-setup-health-service"
import { GE_V1_2_OPERATOR_SETUP_HEALTH_QA_MARKER } from "@/lib/growth/operational/ge-v1-2-operator-setup-health-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, error: "organization_id_required", message: "GROWTH_ENGINE_AI_ORG_ID is required." },
      { status: 503 },
    )
  }

  try {
    const health = await buildGrowthOperatorSetupHealth(access.admin, {
      organizationId,
      userId: access.userId,
    })
    return NextResponse.json({ ok: true, health, qa_marker: GE_V1_2_OPERATOR_SETUP_HEALTH_QA_MARKER })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load operator setup health."
    return NextResponse.json({ ok: false, error: "fetch_failed", message }, { status: 500 })
  }
}
