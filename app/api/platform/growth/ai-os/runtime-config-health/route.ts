import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildGrowthAiosRuntimeConfigHealthSnapshot } from "@/lib/growth/aios/runtime/growth-aios-runtime-config-health-1a"
import { GROWTH_AIOS_LIVE_RUNTIME_CONFIG_PROOF_1A_QA_MARKER } from "@/lib/growth/aios/runtime/growth-aios-runtime-config-health-1a-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  try {
    const snapshot = await buildGrowthAiosRuntimeConfigHealthSnapshot(access.admin)
    return NextResponse.json(snapshot)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AIOS_LIVE_RUNTIME_CONFIG_PROOF_1A_QA_MARKER,
        error: "runtime_config_health_failed",
        message: detail.slice(0, 240),
      },
      { status: 500 },
    )
  }
}
