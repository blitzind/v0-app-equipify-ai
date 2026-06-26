import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  buildExecutionRuntimeValidation,
  cancelGrowthLeadResearchExecution,
  createGrowthLeadResearchExecutionRuntimeStore,
  enqueueGrowthLeadResearchExecution,
  pauseGrowthLeadResearchExecution,
  resumeGrowthLeadResearchExecution,
  runGrowthLeadResearchExecutionLifecycle,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-lifecycle-service"
import { planGrowthLeadResearchExecution } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import { GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const enqueueBodySchema = z.object({
  planId: z.string().min(1),
  leadId: z.string().min(1),
  companyName: z.string().nullable().optional(),
  missionId: z.string().nullable().optional(),
  executionPlan: z.object({}).passthrough(),
  approvalState: z.literal("approved_for_future_execution"),
  confidence: z.number().nullable(),
  runtimeEnabled: z.boolean().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  let body: z.infer<typeof enqueueBodySchema>
  try {
    body = enqueueBodySchema.parse(await request.json())
  } catch {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
        error: "invalid_body",
        message: "Enqueue body is invalid.",
      },
      { status: 400 },
    )
  }

  const organizationId = getGrowthEngineAiOrgId()
  const store = createGrowthLeadResearchExecutionRuntimeStore(access.admin, organizationId)

  try {
    const executionPlan = body.executionPlan as ReturnType<typeof planGrowthLeadResearchExecution>
    const validation = await buildExecutionRuntimeValidation(access.admin, {
      organizationId,
      executionPlan,
      approvalState: body.approvalState,
      confidence: body.confidence,
      runtimeEnabled: body.runtimeEnabled,
    })

    const queued = await enqueueGrowthLeadResearchExecution(store, {
      organizationId,
      planId: body.planId,
      leadId: body.leadId,
      companyName: body.companyName ?? null,
      missionId: body.missionId ?? null,
      executionPlan,
      approvalState: body.approvalState,
      confidence: body.confidence,
      operatorUserId: access.userId,
      runtimeEnabled: body.runtimeEnabled,
    })

    const result = await runGrowthLeadResearchExecutionLifecycle(store, {
      executionId: queued.executionId,
      validation,
    })

    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
      record: result.record,
      validation: result.validation,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
        error: detail,
        message: "Could not enqueue execution.",
      },
      { status: 500 },
    )
  }
}
