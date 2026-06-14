import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildProspectExecutionPlan } from "@/lib/growth/prospect-discovery/prospect-execution-plan-builder"
import { buildProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-plan-builder"
import { parseProspectSearchIntent } from "@/lib/growth/prospect-discovery/prospect-search-parser"
import type { ProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"
import { PROSPECT_EXECUTION_QA_MARKER } from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"
import {
  buildProspectExecutionReadiness,
  resolveProspectProviderEnvSnapshot,
} from "@/lib/growth/prospect-discovery/prospect-execution-readiness"

export const runtime = "nodejs"
export const maxDuration = 60

function resolveSearchPlan(body: Record<string, unknown>): ProspectSearchPlan | null {
  if (body.search_plan && typeof body.search_plan === "object") {
    return body.search_plan as ProspectSearchPlan
  }
  const query = typeof body.query === "string" ? body.query.trim() : ""
  if (query.length >= 3) {
    return buildProspectSearchPlan(parseProspectSearchIntent(query))
  }
  return null
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const searchPlan = body ? resolveSearchPlan(body) : null
  if (!searchPlan) {
    return NextResponse.json(
      { ok: false, error: "search_plan_required", message: "Provide search_plan or query." },
      { status: 400 },
    )
  }

  const execution_plan = buildProspectExecutionPlan({
    search_plan: searchPlan,
    search_plan_id: typeof body?.search_plan_id === "string" ? body.search_plan_id : null,
  })
  const readiness = buildProspectExecutionReadiness({
    search_plan: searchPlan,
    search_plan_id: execution_plan.search_plan_id,
    env: resolveProspectProviderEnvSnapshot(process.env),
  })

  return NextResponse.json({
    ok: true,
    qa_marker: PROSPECT_EXECUTION_QA_MARKER,
    execution_plan,
    readiness,
    requires_human_approval: true,
    execution_enabled: false,
  })
}
