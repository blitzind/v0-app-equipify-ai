import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeOpportunityApprovalEngineInProduction } from "@/lib/growth/meeting-intelligence/opportunity-approval-route"
import {
  assertOpportunityApprovalEngineExecuteAllowed,
  validateOpportunityApprovalEngineConfirmation,
} from "@/lib/growth/meeting-intelligence/opportunity-approval-route-gates"

export const runtime = "nodejs"
export const maxDuration = 120

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const confirmation = validateOpportunityApprovalEngineConfirmation(body)
  if (!confirmation.ok || !confirmation.draft_id) {
    return NextResponse.json(
      { ok: false, message: confirmation.error ?? "Invalid confirmation." },
      { status: 400 },
    )
  }

  const gates = assertOpportunityApprovalEngineExecuteAllowed(process.env)
  if (!gates.ok) {
    return NextResponse.json(
      { ok: false, blockers: gates.blockers, message: gates.error },
      { status: 403 },
    )
  }

  const result = await executeOpportunityApprovalEngineInProduction(access.admin, {
    draft_id: confirmation.draft_id,
    certification_mode: confirmation.certification_mode,
    env: process.env,
    operator_id: access.userId,
    operator_email: access.userEmail,
  })

  logGrowthEngine("opportunity_approval_engine_execute_route", {
    execution_id: result.execution_id,
    ok: result.ok,
    error: result.error ?? null,
    opportunity_created: result.report?.opportunity_created ?? false,
    auto_created: false,
    human_confirmed: true,
    operator_required: true,
  })

  if (!result.ok) {
    return NextResponse.json(result, { status: result.error === "gates_failed" ? 403 : 500 })
  }

  return NextResponse.json(result)
}
