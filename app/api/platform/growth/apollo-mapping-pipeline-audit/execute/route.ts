import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloMappingPipelineAuditInProduction } from "@/lib/growth/apollo/apollo-mapped-contact-pipeline-audit-route"
import { validateApolloMappingPipelineAuditConfirmation } from "@/lib/growth/apollo/apollo-mapped-contact-pipeline-audit-route-gates"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloMappingPipelineAuditConfirmation(body)
  if (!confirmation.ok) {
    return NextResponse.json(
      { ok: false, error: "confirmation_required", message: confirmation.error },
      { status: 400 },
    )
  }

  const startedMs = Date.now()
  const result = await executeApolloMappingPipelineAuditInProduction(access.admin, {
    env: process.env,
  })

  logGrowthEngine("apollo_mapping_pipeline_audit_execute", {
    execution_id: result.execution_id,
    ok: result.ok,
    duration_ms: Date.now() - startedMs,
    mapped_contacts: result.report?.apollo_people_mapped ?? 0,
    auto_enrollment: false,
    outreach_sent: false,
  })

  if (!result.ok && result.error === "gates_failed") {
    return NextResponse.json(result, { status: 403 })
  }
  return NextResponse.json(result)
}
