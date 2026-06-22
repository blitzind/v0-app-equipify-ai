import { NextResponse } from "next/server"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { buildGrowthInfrastructureReadinessCatalog } from "@/lib/growth/infrastructure/infrastructure-readiness"
import { GROWTH_INFRASTRUCTURE_READINESS_QA_MARKER } from "@/lib/growth/infrastructure/infrastructure-readiness-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_INFRASTRUCTURE_READINESS_QA_MARKER,
    catalog: buildGrowthInfrastructureReadinessCatalog(),
  })
}
