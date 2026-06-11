import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloFullPipelineProductionCertification } from "@/lib/growth/apollo/apollo-full-pipeline-production-route"
import { validateApolloFullPipelineProductionCertificationConfirmation } from "@/lib/growth/apollo/apollo-full-pipeline-production-route-gates"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloFullPipelineProductionCertificationConfirmation(body)
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
  const result = await executeApolloFullPipelineProductionCertification(access.admin, {
    company_candidate_id: confirmation.company_candidate_id,
    enrollment_candidate_id: confirmation.enrollment_candidate_id,
    env: process.env,
  })

  logGrowthEngine("apollo_full_pipeline_production_certification_execute", {
    execution_id: result.execution_id,
    ok: result.ok,
    error: result.ok ? null : result.error ?? null,
    message: result.ok ? null : result.message ?? null,
    duration_ms: Date.now() - startedMs,
    company_candidate_id: confirmation.company_candidate_id,
    certified: result.certification?.certified ?? false,
    stage_ids: result.certification?.stage_ids ?? null,
    outreach_sent: false,
    jobs_scheduled: false,
    email_sent: false,
    sms_sent: false,
    voice_drop_sent: false,
  })

  if (!result.ok && result.error === "gates_failed") {
    return NextResponse.json(result, { status: 403 })
  }
  return NextResponse.json(result, { status: 200 })
}
