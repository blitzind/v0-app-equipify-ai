import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildGrowthAiosAutonomyTickHealthSnapshot } from "@/lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a"
import { GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER } from "@/lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  let dryRun = true
  try {
    const body = (await request.json().catch(() => ({}))) as { dryRun?: boolean }
    dryRun = body.dryRun !== false
  } catch {
    dryRun = true
  }

  if (!dryRun) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER,
        error: "dry_run_required",
        message: "Autonomy tick health accepts dryRun:true only.",
      },
      { status: 400 },
    )
  }

  try {
    const snapshot = await buildGrowthAiosAutonomyTickHealthSnapshot(access.admin)
    return NextResponse.json(snapshot)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER,
        error: "autonomy_tick_health_failed",
        message: detail.slice(0, 240),
      },
      { status: 500 },
    )
  }
}
