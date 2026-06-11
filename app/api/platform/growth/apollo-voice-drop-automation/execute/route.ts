import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloVoiceDropAutomationInProduction } from "@/lib/growth/apollo/apollo-voice-drop-automation-route"
import { validateApolloVoiceDropAutomationConfirmation } from "@/lib/growth/apollo/apollo-voice-drop-automation-route-gates"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloVoiceDropAutomationConfirmation(body)
  if (!confirmation.ok || !confirmation.enrollment_candidate_id) {
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
  const result = await executeApolloVoiceDropAutomationInProduction(access.admin, {
    enrollment_candidate_id: confirmation.enrollment_candidate_id,
    certification_mode: confirmation.certification_mode,
    env: process.env,
  })

  logGrowthEngine("apollo_voice_drop_automation_execute", {
    execution_id: result.execution_id,
    ok: result.ok,
    error: result.ok ? null : result.error ?? null,
    message: result.ok ? null : result.message ?? null,
    duration_ms: Date.now() - startedMs,
    enrollment_candidate_id: confirmation.enrollment_candidate_id,
    certification_mode: confirmation.certification_mode,
    candidates_created: result.report?.candidates_created ?? 0,
    certified: result.certification?.certified ?? false,
    voice_drop_sent: false,
    outreach_sent: false,
    draft_created: false,
  })

  if (!result.ok && result.error === "gates_failed") {
    return NextResponse.json(result, { status: 403 })
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
