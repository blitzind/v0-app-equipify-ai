import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  assertProspectExecutionExecuteAllowed,
  executeProspectExecutionPlannerCertification,
} from "@/lib/growth/prospect-discovery/prospect-execution-certification"
import { PROSPECT_EXECUTION_EXECUTE_CONFIRM } from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const gateCheck = assertProspectExecutionExecuteAllowed(process.env)
  if (!gateCheck.ok) {
    return NextResponse.json({ ok: false, blockers: gateCheck.blockers }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const confirm = (body as Record<string, unknown> | null)?.confirm
  if (confirm !== PROSPECT_EXECUTION_EXECUTE_CONFIRM) {
    return NextResponse.json({ ok: false, error: "confirm_token_mismatch" }, { status: 400 })
  }

  const report = await executeProspectExecutionPlannerCertification(access.admin, {
    dry_run: (body as Record<string, unknown>)?.dry_run === true,
  })
  return NextResponse.json(report, { status: report.ok ? 200 : 422 })
}
