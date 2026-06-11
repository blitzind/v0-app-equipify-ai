import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeOpportunityDraftEngineInProduction } from "@/lib/growth/meeting-intelligence/opportunity-draft-route"
import {
  assertOpportunityDraftEngineExecuteAllowed,
  validateOpportunityDraftEngineConfirmation,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-route-gates"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const confirmation = validateOpportunityDraftEngineConfirmation(body)
  if (!confirmation.ok || !confirmation.meeting_id) {
    return NextResponse.json(
      { ok: false, message: confirmation.error ?? "Invalid confirmation." },
      { status: 400 },
    )
  }

  const gates = assertOpportunityDraftEngineExecuteAllowed(process.env)
  if (!gates.ok) {
    return NextResponse.json(
      { ok: false, blockers: gates.blockers, message: gates.error },
      { status: 403 },
    )
  }

  const result = await executeOpportunityDraftEngineInProduction(access.admin, {
    meeting_id: confirmation.meeting_id,
    certification_mode: confirmation.certification_mode,
    env: process.env,
    actor_user_id: access.userId,
    actor_email: access.userEmail,
  })

  logGrowthEngine("opportunity_draft_engine_execute_route", {
    execution_id: result.execution_id,
    ok: result.ok,
    error: result.error ?? null,
    opportunity_created: false,
    crm_written: false,
    deal_created: false,
    calendar_written: false,
  })

  if (!result.ok) {
    return NextResponse.json(result, { status: result.error === "gates_failed" ? 403 : 500 })
  }

  return NextResponse.json(result)
}
