import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  retryAvaOutreachExecutionRequestFulfillment,
} from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-service"
import { GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER } from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-types"
import { GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER } from "@/lib/growth/mission-center/growth-ava-outreach-sequence-handoff-1f"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ requestId: string }> }

const bodySchema = z.object({
  leadId: z.string().uuid(),
})

function retryErrorStatus(error: string): number {
  if (error === "execution_request_not_found") return 404
  if (error === "ava_outreach_execution_request_disabled") return 403
  if (
    error === "execution_request_already_fulfilled" ||
    error === "execution_request_not_retryable" ||
    error === "outreach_package_not_approved"
  ) {
    return 409
  }
  if (
    error === "execution_not_ready" ||
    error === "no_sequence_pattern" ||
    error === "low_confidence" ||
    error === "fatigue_blocked" ||
    error === "preflight_blocked"
  ) {
    return 422
  }
  return 500
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
        error: "organization_required",
      },
      { status: 400 },
    )
  }

  const { requestId } = await context.params
  if (!requestId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
        error: "request_id_required",
      },
      { status: 400 },
    )
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
        error: "invalid_body",
      },
      { status: 400 },
    )
  }

  try {
    const executionRequest = await retryAvaOutreachExecutionRequestFulfillment(access.admin, {
      organizationId,
      leadId: body.leadId,
      requestId,
      operatorUserId: access.userId,
      operatorEmail: access.userEmail,
    })

    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
      handoffQaMarker: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER,
      executionRequest,
      transportBlocked: true,
      message:
        executionRequest.executionStatus === "queued"
          ? "Execution request retried — sequence job queued. Transport remains gated."
          : "Execution request retry completed with a non-queued status.",
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
        error: detail,
      },
      { status: retryErrorStatus(detail) },
    )
  }
}
