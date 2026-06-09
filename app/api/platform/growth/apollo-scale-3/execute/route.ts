import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloScale3InProduction } from "@/lib/growth/apollo/apollo-scale-3-production-route"
import { validateApolloScale3Confirmation } from "@/lib/growth/apollo/apollo-scale-3-production-route-gates"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloScale3Confirmation(body)
  if (!confirmation.ok) {
    return NextResponse.json(
      { ok: false, error: "confirmation_required", message: confirmation.error },
      { status: 400 },
    )
  }

  const startedMs = Date.now()
  const result = await executeApolloScale3InProduction(access.admin, {
    company_limit: confirmation.company_limit,
    contact_limit: confirmation.contact_limit,
    created_by: access.userId,
    env: process.env,
  })

  logGrowthEngine("apollo_scale_3_production_execute", {
    execution_id: result.execution_id,
    ok: result.ok,
    verdict: result.verdict,
    duration_ms: Date.now() - startedMs,
    companies_processed: result.companies.length,
    tier_4_companies: result.companies.filter((row) => row.tier_used === 4).length,
    mapped_companies: result.companies.filter((row) => row.mapped_contacts > 0).length,
    auto_enrollment: false,
    outreach_sent: false,
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
