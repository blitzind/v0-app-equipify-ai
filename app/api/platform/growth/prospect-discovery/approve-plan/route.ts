import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildProspectExecutionPlan } from "@/lib/growth/prospect-discovery/prospect-execution-plan-builder"
import { persistProspectExecutionPlanApproval } from "@/lib/growth/prospect-discovery/prospect-execution-certification"
import type { ProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"
import { PROSPECT_EXECUTION_QA_MARKER } from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const searchPlan = body?.search_plan as ProspectSearchPlan | undefined
  const searchPlanId = typeof body?.search_plan_id === "string" ? body.search_plan_id : null

  if (!searchPlan || !searchPlanId) {
    return NextResponse.json(
      { ok: false, error: "approval_input_required", message: "Provide search_plan and search_plan_id." },
      { status: 400 },
    )
  }

  const execution_plan = buildProspectExecutionPlan({
    search_plan: searchPlan,
    search_plan_id: searchPlanId,
  })

  const result = await persistProspectExecutionPlanApproval(access.admin, {
    search_plan_id: searchPlanId,
    execution_plan,
    approved_by_user_id: access.userId,
  })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "approval_failed" },
      { status: 422 },
    )
  }

  return NextResponse.json({
    ok: true,
    qa_marker: PROSPECT_EXECUTION_QA_MARKER,
    approval: result.approval,
    execution_plan,
    execution_enabled: false,
    outreach_enabled: false,
    enrollment_enabled: false,
    requires_human_approval: true,
  })
}
