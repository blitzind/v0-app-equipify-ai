import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloProductionYieldBenchmarkInProduction } from "@/lib/growth/apollo/apollo-production-yield-benchmark-route"
import { validateApolloProductionYieldBenchmarkConfirmation } from "@/lib/growth/apollo/apollo-production-yield-benchmark-route-gates"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloProductionYieldBenchmarkConfirmation(body)
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
  const result = await executeApolloProductionYieldBenchmarkInProduction(access.admin, {
    company_limit: confirmation.company_limit,
    contact_limit: confirmation.contact_limit,
    created_by: access.userId,
    env: process.env,
  })

  logGrowthEngine("apollo_production_yield_benchmark_execute", {
    execution_id: result.execution_id,
    benchmark_id: result.benchmark_id,
    ok: result.ok,
    error: result.ok ? null : result.error ?? null,
    message: result.ok ? null : result.message ?? null,
    duration_ms: Date.now() - startedMs,
    companies_processed: result.benchmark?.aggregate.companies_processed ?? 0,
    sequence_ready_contacts: result.benchmark?.aggregate.sequence_ready_contacts ?? 0,
    estimated_credits_consumed: result.benchmark?.economics.estimated_credits_consumed ?? 0,
    benchmark_passed_for_scale: result.benchmark?.recommendation.benchmark_passed_for_scale ?? false,
    certification_mode: "greenfield",
    auto_enrollment: false,
    outreach_sent: false,
    scheduler_ran: false,
    draft_created: false,
    sequence_scheduled: false,
  })

  if (!result.ok && result.error === "gates_failed") {
    return NextResponse.json(result, { status: 403 })
  }
  if (!result.ok && result.error === "cohort_failed") {
    return NextResponse.json(result, { status: 422 })
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
