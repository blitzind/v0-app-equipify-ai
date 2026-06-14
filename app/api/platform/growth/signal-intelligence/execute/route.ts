import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeSignalIntelligenceCertification } from "@/lib/growth/signal-intelligence/signal-intelligence-route"
import {
  assertSignalIntelligenceExecuteAllowed,
  validateSignalIntelligenceCertificationConfirmation,
} from "@/lib/growth/signal-intelligence/signal-intelligence-route-gates"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const gateCheck = assertSignalIntelligenceExecuteAllowed(process.env)
  if (!gateCheck.ok) {
    return NextResponse.json(
      { ok: false, error: "gates_blocked", blockers: gateCheck.blockers },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => null)
  const confirmation = validateSignalIntelligenceCertificationConfirmation(body)
  if (!confirmation.ok) {
    return NextResponse.json(
      { ok: false, error: "confirmation_required", message: confirmation.error },
      { status: 400 },
    )
  }

  const startedMs = Date.now()
  const result = await executeSignalIntelligenceCertification(access.admin, {
    henry_lead_id: confirmation.henry_lead_id,
    dry_run: confirmation.dry_run,
  })

  logGrowthEngine("signal_intelligence_certification_execute", {
    execution_id: result.execution_id,
    ok: result.ok,
    dry_run: confirmation.dry_run,
    duration_ms: Date.now() - startedMs,
    blockers: "blockers" in result ? result.blockers : [],
  })

  return NextResponse.json(result, { status: result.ok ? 200 : 422 })
}
