import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { prepareApolloLivePilotTestCompanyInProduction } from "@/lib/growth/apollo/apollo-live-pilot-test-company-prepare-route"
import { validateApolloLivePilotTestCompanyPrepareConfirmation } from "@/lib/growth/apollo/apollo-live-pilot-production-route-gates"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloLivePilotTestCompanyPrepareConfirmation(body)
  if (!confirmation.ok || !confirmation.profile) {
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
  const result = await prepareApolloLivePilotTestCompanyInProduction(access.admin, {
    profile: confirmation.profile,
  })

  logGrowthEngine("apollo_live_pilot_test_company_prepare", {
    ok: result.ok,
    created: result.created,
    profile: result.profile,
    company_candidate_id: result.company_candidate_id?.slice(0, 8) ?? null,
    domain: result.domain,
    duration_ms: Date.now() - startedMs,
    actor_user_id: access.userId,
  })

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}
