import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloEnrollmentAutomationInProduction } from "@/lib/growth/apollo/apollo-enrollment-automation-route"
import { validateApolloEnrollmentAutomationConfirmation } from "@/lib/growth/apollo/apollo-enrollment-automation-route-gates"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloEnrollmentAutomationConfirmation(body)
  if (!confirmation.ok || !confirmation.company_candidate_id) {
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
  const result = await executeApolloEnrollmentAutomationInProduction(access.admin, {
    company_candidate_id: confirmation.company_candidate_id,
    certification_mode: confirmation.certification_mode,
    created_by: access.userId,
    env: process.env,
  })

  logGrowthEngine("apollo_enrollment_automation_execute", {
    execution_id: result.execution_id,
    ok: result.ok,
    error: result.ok ? null : result.error ?? null,
    message: result.ok ? null : result.message ?? null,
    duration_ms: Date.now() - startedMs,
    company_candidate_id: confirmation.company_candidate_id,
    certification_mode: confirmation.certification_mode,
    contacts_qualified: result.report?.contacts_qualified ?? 0,
    candidates_created: result.report?.candidates_created ?? 0,
    certified: result.certification?.certified ?? false,
    auto_enrollment: false,
    outreach_sent: false,
    draft_created: false,
    sequence_scheduled: false,
  })

  if (!result.ok && result.error === "gates_failed") {
    return NextResponse.json(result, { status: 403 })
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
