import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloScale5AInProduction } from "@/lib/growth/apollo/apollo-scale-5a-production-route"
import { validateApolloScale5AConfirmation } from "@/lib/growth/apollo/apollo-scale-5a-production-route-gates"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloScale5AConfirmation(body)
  if (!confirmation.ok) {
    return NextResponse.json(
      { ok: false, error: "confirmation_required", message: confirmation.error },
      { status: 400 },
    )
  }

  const startedMs = Date.now()
  const result = await executeApolloScale5AInProduction(access.admin, { env: process.env })

  logGrowthEngine("apollo_scale_5a_contactable_eligibility_audit_execute", {
    execution_id: result.execution_id,
    ok: result.ok,
    duration_ms: Date.now() - startedMs,
    contacts_audited: result.report?.contacts.length ?? 0,
    auto_enrollment: false,
    outreach_sent: false,
  })

  if (!result.ok && result.error === "gates_failed") {
    return NextResponse.json(result, { status: 403 })
  }

  return NextResponse.json(result)
}
