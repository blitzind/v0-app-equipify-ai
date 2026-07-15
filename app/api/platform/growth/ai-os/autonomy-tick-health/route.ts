import { NextResponse } from "next/server"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildGrowthAiosAutonomyTickHealthSnapshot } from "@/lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a"
import {
  AutonomyTickHealthBuildError,
  GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER,
} from "@/lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a-types"

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
    const stage =
      error instanceof AutonomyTickHealthBuildError ? error.stage : "initializing"
    const diagnostics =
      error instanceof AutonomyTickHealthBuildError ? error.diagnostics : null

    logGrowthEngine("autonomy_tick_health_route_failed", {
      qa_marker: GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER,
      stage,
      error_class: error instanceof Error ? error.name : "UnknownError",
      organization_resolved: diagnostics?.organizationResolved ?? null,
      portfolio_snapshot_built: diagnostics?.portfolioSnapshotBuilt ?? null,
      work_selected: diagnostics?.workSelected ?? null,
      decision_resolution_started: diagnostics?.decisionResolutionStarted ?? null,
      authority_evaluation_started: diagnostics?.authorityEvaluationStarted ?? null,
      stack: error instanceof Error ? error.stack : null,
    })

    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER,
        error: "autonomy_tick_health_failed",
        stage,
      },
      { status: 500 },
    )
  }
}
