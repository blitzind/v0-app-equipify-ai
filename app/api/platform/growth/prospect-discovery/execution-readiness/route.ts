import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
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

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const query = url.searchParams.get("query")?.trim() ?? ""

  let searchPlan: ProspectSearchPlan | null = null
  if (query.length >= 3) {
    searchPlan = buildProspectSearchPlan(parseProspectSearchIntent(query))
  }

  const readiness = searchPlan
    ? buildProspectExecutionReadiness({
        search_plan: searchPlan,
        env: resolveProspectProviderEnvSnapshot(process.env),
      })
    : {
        qa_marker: PROSPECT_EXECUTION_QA_MARKER,
        search_plan_id: null,
        status: "blocked" as const,
        reasons: [
          {
            code: "input_required",
            severity: "blocker" as const,
            message: "Provide query parameter to evaluate execution readiness.",
          },
        ],
        provider_status: [],
        requires_human_approval: true as const,
        execution_enabled: false as const,
      }

  return NextResponse.json({
    ok: true,
    qa_marker: PROSPECT_EXECUTION_QA_MARKER,
    readiness,
    execution_enabled: false,
  })
}
