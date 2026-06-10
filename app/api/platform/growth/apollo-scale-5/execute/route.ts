import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloScale5InProduction } from "@/lib/growth/apollo/apollo-scale-5-production-route"
import { validateApolloScale5Confirmation } from "@/lib/growth/apollo/apollo-scale-5-production-route-gates"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloScale5Confirmation(body)
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
  const result = await executeApolloScale5InProduction(access.admin, {
    contact_limit: confirmation.contact_limit,
    created_by: access.userId,
    env: process.env,
  })

  logGrowthEngine("apollo_scale_5_production_execute", {
    execution_id: result.execution_id,
    ok: result.ok,
    error: result.ok ? null : result.error ?? null,
    message: result.ok ? null : result.message ?? null,
    duration_ms: Date.now() - startedMs,
    mapped_contacts: result.certification?.search.mapped_contacts ?? 0,
    verified_email_contacts: result.certification?.promotion.verified_email_contacts ?? 0,
    promoted_contacts: result.certification?.readiness.promoted_contacts ?? 0,
    contactable_contacts: result.certification?.readiness.contactable_contacts ?? 0,
    sequence_ready_contacts: result.certification?.readiness.sequence_ready_contacts ?? 0,
    verdict: result.verdict,
    auto_enrollment: false,
    outreach_sent: false,
    scheduler_run: false,
    execution_created: false,
  })

  if (!result.ok && result.error === "gates_failed") {
    return NextResponse.json(result, { status: 403 })
  }

  if (!result.ok && result.error === "target_company_failed") {
    return NextResponse.json(result, { status: 422 })
  }

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}
