import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  assertHumanInterventionExecuteAllowed,
  HUMAN_INTERVENTION_CONFIRM,
} from "@/lib/growth/human-interventions/human-intervention-route-gates"
import { executeHumanInterventionCertification } from "@/lib/growth/human-interventions/human-intervention-certification"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const gateCheck = assertHumanInterventionExecuteAllowed(process.env)
  if (!gateCheck.ok) {
    return NextResponse.json({ ok: false, blockers: gateCheck.blockers }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const confirm = (body as Record<string, unknown> | null)?.confirm
  if (confirm !== HUMAN_INTERVENTION_CONFIRM) {
    return NextResponse.json({ ok: false, error: "confirm_token_mismatch" }, { status: 400 })
  }

  const report = await executeHumanInterventionCertification(access.admin, {
    dry_run: (body as Record<string, unknown>)?.dry_run === true,
  })

  return NextResponse.json(report, { status: report.ok ? 200 : 422 })
}
