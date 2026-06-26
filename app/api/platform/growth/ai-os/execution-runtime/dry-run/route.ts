import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { planGrowthLeadResearchExecution } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import {
  GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_QA_MARKER,
  GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_RULE,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-types"
import { runGrowthLeadResearchExecutionDryRun } from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const dryRunBodySchema = z.object({
  planId: z.string().min(1),
  leadId: z.string().min(1),
  executionPlan: z.object({}).passthrough(),
  approvalState: z.literal("approved_for_future_execution"),
  confidence: z.number().nullable(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  let body: z.infer<typeof dryRunBodySchema>
  try {
    body = dryRunBodySchema.parse(await request.json())
  } catch {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_QA_MARKER,
        error: "invalid_body",
        message: "Dry-run body is invalid.",
      },
      { status: 400 },
    )
  }

  const organizationId = getGrowthEngineAiOrgId()

  try {
    const executionPlan = body.executionPlan as ReturnType<typeof planGrowthLeadResearchExecution>
    const report = await runGrowthLeadResearchExecutionDryRun(access.admin, {
      organizationId,
      planId: body.planId,
      leadId: body.leadId,
      executionPlan,
      approvalState: body.approvalState,
      confidence: body.confidence,
    })

    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_QA_MARKER,
      dryRunRule: GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_RULE,
      report,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_QA_MARKER,
        error: detail,
        message: "Could not run internal workflow dry-run.",
      },
      { status: 500 },
    )
  }
}
