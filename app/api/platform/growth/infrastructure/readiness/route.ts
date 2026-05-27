import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildGrowthInfrastructureReadinessCatalog } from "@/lib/growth/infrastructure/infrastructure-readiness"
import { GROWTH_INFRASTRUCTURE_READINESS_QA_MARKER } from "@/lib/growth/infrastructure/infrastructure-readiness-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_INFRASTRUCTURE_READINESS_QA_MARKER,
    catalog: buildGrowthInfrastructureReadinessCatalog(),
  })
}
