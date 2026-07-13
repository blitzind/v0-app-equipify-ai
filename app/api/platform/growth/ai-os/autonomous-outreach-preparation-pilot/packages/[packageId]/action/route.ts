import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchAvaOutreachExecutionRequestByPackageId,
  submitAvaOutreachPackageApprovalAction,
} from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-service"
import { GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER } from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ packageId: string }> }

const actionBodySchema = z.object({
  decision: z.enum(["approve", "reject"]),
  leadId: z.string().min(1),
  note: z.string().max(500).optional(),
  draftEdits: z
    .record(
      z.enum([
        "email",
        "linkedin",
        "sms",
        "voicemail",
        "call",
        "sendr",
        "follow_up",
        "meeting_request",
      ]),
      z.string().max(8000),
    )
    .optional(),
})

function actionErrorStatus(error: string): number {
  if (error === "outreach_package_not_found") return 404
  if (error === "ava_outreach_execution_request_disabled") return 403
  if (
    error === "outreach_package_already_decided" ||
    error === "execution_request_already_exists"
  ) {
    return 409
  }
  return 500
}

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { packageId } = await context.params
  const url = new URL(_request.url)
  const leadId = url.searchParams.get("leadId")
  if (!packageId || !leadId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
        error: "package_id_and_lead_id_required",
      },
      { status: 400 },
    )
  }

  const executionRequest = await fetchAvaOutreachExecutionRequestByPackageId(access.admin, {
    leadId,
    packageId,
  })

  return NextResponse.json({
    ok: true,
    qaMarker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
    executionRequest,
  })
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { packageId } = await context.params
  if (!packageId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
        error: "package_id_required",
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
        qaMarker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
        error: "invalid_body",
      },
      { status: 400 },
    )
  }

  const organizationId = getGrowthEngineAiOrgId()

  try {
    const result = await submitAvaOutreachPackageApprovalAction(access.admin, {
      organizationId,
      packageId,
      decision: body.decision,
      operatorUserId: access.userId,
      operatorEmail: access.userEmail,
      note: body.note ?? null,
      draftEdits: body.draftEdits,
    })

    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
      result,
      transportBlocked: true,
      message:
        body.decision === "approve"
          ? "Package approved — execution request created. Sequence transport remains gated by existing job approval."
          : "Package rejected — no execution request created.",
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
        error: detail,
      },
      { status: actionErrorStatus(detail) },
    )
  }
}
