import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildDatamoonAutonomousDiscoveryHealthSnapshot } from "@/lib/growth/prospect-search/prospect-search-datamoon-discovery-health-1a"
import { GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  try {
    const snapshot = await buildDatamoonAutonomousDiscoveryHealthSnapshot(access.admin)
    return NextResponse.json(snapshot)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
        error: "datamoon_discovery_health_failed",
        message: detail.slice(0, 240),
      },
      { status: 500 },
    )
  }
}
