import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  pauseProspectDiscoveryExecution,
  resumeProspectDiscoveryExecution,
} from "@/lib/growth/prospect-discovery/prospect-execution-runner"
import { PROSPECT_DISCOVERY_EXECUTION_QA_MARKER } from "@/lib/growth/prospect-discovery/prospect-execution-run-types"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const execution_run_id = typeof body?.execution_run_id === "string" ? body.execution_run_id : ""
  const action = typeof body?.action === "string" ? body.action : "pause"

  if (!execution_run_id) {
    return NextResponse.json({ ok: false, error: "execution_run_id_required" }, { status: 400 })
  }

  if (action === "resume") {
    const result = await resumeProspectDiscoveryExecution(access.admin, execution_run_id)
    return NextResponse.json({
      ok: result.ok,
      qa_marker: PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
      action: "resume",
    })
  }

  const result = await pauseProspectDiscoveryExecution(access.admin, execution_run_id)
  return NextResponse.json({
    ok: result.ok,
    qa_marker: PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
    action: "pause",
    run: result.run ?? null,
    enrollment_enabled: false,
    outreach_enabled: false,
  })
}
