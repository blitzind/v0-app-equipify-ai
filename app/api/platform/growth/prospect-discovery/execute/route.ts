import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildProspectExecutionPlan } from "@/lib/growth/prospect-discovery/prospect-execution-plan-builder"
import {
  PROSPECT_DISCOVERY_EXECUTION_CONFIRM,
  PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
} from "@/lib/growth/prospect-discovery/prospect-execution-run-types"
import { runProspectDiscoveryExecution } from "@/lib/growth/prospect-discovery/prospect-execution-runner"
import type { ProspectExecutionPlan } from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"
import type { ProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"
import { assertProspectDiscoveryExecutionAllowed } from "@/lib/growth/prospect-discovery/prospect-discovery-execution-certification"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const gateCheck = assertProspectDiscoveryExecutionAllowed(process.env)
  if (!gateCheck.ok) {
    return NextResponse.json({ ok: false, blockers: gateCheck.blockers }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const confirm = typeof body?.confirm === "string" ? body.confirm : ""
  const search_plan_id = typeof body?.search_plan_id === "string" ? body.search_plan_id : ""
  const search_plan = body?.search_plan as ProspectSearchPlan | undefined
  const execution_plan = body?.execution_plan as ProspectExecutionPlan | undefined
  const certification_mode = body?.certification_mode === true

  if (confirm !== PROSPECT_DISCOVERY_EXECUTION_CONFIRM) {
    return NextResponse.json({ ok: false, error: "confirm_token_required" }, { status: 400 })
  }
  if (!search_plan || !search_plan_id) {
    return NextResponse.json({ ok: false, error: "search_plan_required" }, { status: 400 })
  }

  const resolvedExecutionPlan =
    execution_plan ?? buildProspectExecutionPlan({ search_plan, search_plan_id })

  const result = await runProspectDiscoveryExecution(access.admin, {
    search_plan,
    execution_plan: resolvedExecutionPlan,
    search_plan_id,
    operator_id: access.userId,
    confirm: PROSPECT_DISCOVERY_EXECUTION_CONFIRM,
    certification_mode,
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        qa_marker: PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
        error: result.error ?? "execution_failed",
        blockers: result.blockers ?? [],
        run: result.run ?? null,
      },
      { status: 422 },
    )
  }

  return NextResponse.json({
    ok: true,
    qa_marker: PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
    run: result.run,
    progress: result.progress,
    enrollment_enabled: false,
    outreach_enabled: false,
    requires_human_approval: true,
  })
}
