import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloLivePilotInProduction } from "@/lib/growth/apollo/apollo-live-pilot-production-route"
import { validateApolloLivePilotProductionExecuteConfirmation } from "@/lib/growth/apollo/apollo-live-pilot-production-route-gates"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloLivePilotProductionExecuteConfirmation(body)
  if (!confirmation.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "confirmation_required",
        message: confirmation.error,
      },
      { status: 400 },
    )
  }

  const startedMs = Date.now()
  const result = await executeApolloLivePilotInProduction(access.admin, {
    userId: access.userId,
  })

  logGrowthEngine("apollo_live_pilot_production_execute", {
    execution_id: result.execution_id,
    company_candidate_id: result.company_candidate_id?.slice(0, 8) ?? null,
    ok: result.ok,
    error: result.ok ? null : result.error ?? null,
    message: result.ok ? null : result.message ?? null,
    duration_ms: Date.now() - startedMs,
    actor_user_id: access.userId,
    api_calls: result.evidence_bundle?.runtime.api_calls ?? null,
    failure_errors: result.evidence_bundle?.errors ?? null,
  })

  if (!result.ok && result.error === "gates_failed") {
    return NextResponse.json(result, { status: 403 })
  }

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}
