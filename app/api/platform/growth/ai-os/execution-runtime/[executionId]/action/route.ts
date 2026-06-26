import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  buildExecutionRuntimeValidation,
  cancelGrowthLeadResearchExecution,
  createGrowthLeadResearchExecutionRuntimeStore,
  pauseGrowthLeadResearchExecution,
  resumeGrowthLeadResearchExecution,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-lifecycle-service"
import { GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ executionId: string }> }

const actionBodySchema = z.object({
  action: z.enum(["pause", "resume", "cancel"]),
  executionPlan: z.object({}).passthrough().optional(),
  approvalState: z.literal("approved_for_future_execution").optional(),
  confidence: z.number().nullable().optional(),
  runtimeEnabled: z.boolean().optional(),
})

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { executionId } = await context.params
  if (!executionId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
        error: "execution_id_required",
      },
      { status: 400 },
    )
  }

  let body: z.infer<typeof actionBodySchema>
  try {
    body = actionBodySchema.parse(await request.json())
  } catch {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
        error: "invalid_body",
      },
      { status: 400 },
    )
  }

  const organizationId = getGrowthEngineAiOrgId()
  const store = createGrowthLeadResearchExecutionRuntimeStore(access.admin, organizationId)

  try {
    if (body.action === "pause") {
      const record = await pauseGrowthLeadResearchExecution(store, executionId)
      return NextResponse.json({ ok: true, qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER, record })
    }

    if (body.action === "cancel") {
      const record = await cancelGrowthLeadResearchExecution(store, executionId)
      return NextResponse.json({ ok: true, qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER, record })
    }

    const existing = await store.get(executionId)
    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          qaMarker: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
          error: "execution_not_found",
        },
        { status: 404 },
      )
    }

    const validation = await buildExecutionRuntimeValidation(access.admin, {
      organizationId,
      executionPlan: body.executionPlan ?? existing.executionPlan,
      approvalState: body.approvalState ?? "approved_for_future_execution",
      confidence: body.confidence ?? null,
      runtimeEnabled: body.runtimeEnabled,
    })

    const result = await resumeGrowthLeadResearchExecution(store, {
      executionId,
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
      },
      { status: 500 },
    )
  }
}
