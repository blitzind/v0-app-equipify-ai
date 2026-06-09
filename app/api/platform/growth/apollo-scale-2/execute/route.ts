import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloScale2InProduction } from "@/lib/growth/apollo/apollo-scale-2-production-route"
import { validateApolloScale2Confirmation } from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloScale2Confirmation(body)
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
  const result = await executeApolloScale2InProduction(access.admin, {
    company_limit: confirmation.company_limit,
    contact_limit: confirmation.contact_limit,
    created_by: access.userId,
    env: process.env,
  })

  logGrowthEngine("apollo_scale_2_production_execute", {
    execution_id: result.execution_id,
    ok: result.ok,
    error: result.ok ? null : result.error ?? null,
    message: result.ok ? null : result.message ?? null,
    duration_ms: Date.now() - startedMs,
    companies_processed: result.evidence_bundle?.certification.aggregate.companies_processed ?? 0,
    apollo_contacts_found: result.evidence_bundle?.certification.aggregate.apollo_contacts_found ?? 0,
    sequence_ready_contacts:
      result.evidence_bundle?.certification.aggregate.sequence_ready_contacts ?? 0,
    credits_consumed: result.evidence_bundle?.certification.credit_efficiency.apollo_credits_consumed ?? 0,
    verdict: result.evidence_bundle?.verdict ?? null,
    auto_enrollment: false,
    outreach_sent: false,
    scheduler_run: false,
    execution_created: false,
  })

  if (!result.ok && result.error === "gates_failed") {
    return NextResponse.json(result, { status: 403 })
  }

  if (!result.ok && result.error === "cohort_failed") {
    return NextResponse.json(result, { status: 422 })
  }

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}
