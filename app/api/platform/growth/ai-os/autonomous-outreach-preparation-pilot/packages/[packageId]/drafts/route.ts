import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { projectApprovals2AOperatorReviewPacket } from "@/lib/growth/aios/approvals/approvals-operator-review-packet"
import { GROWTH_AIOS_SEND_PLANE_1B_QA_MARKER } from "@/lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence"
import { persistOperatorPackageDraftEdits } from "@/lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence-service"
import { SEND_PLANE_1B_EDITABLE_PACKAGE_CHANNELS } from "@/lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ packageId: string }> }

const draftsBodySchema = z.object({
  leadId: z.string().uuid(),
  draftEdits: z
    .record(z.enum(SEND_PLANE_1B_EDITABLE_PACKAGE_CHANNELS), z.string().max(8000))
    .default({}),
})

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { packageId } = await context.params
  if (!packageId) {
    return NextResponse.json(
      { ok: false, qaMarker: GROWTH_AIOS_SEND_PLANE_1B_QA_MARKER, error: "package_id_required" },
      { status: 400 },
    )
  }

  let body: z.infer<typeof draftsBodySchema>
  try {
    body = draftsBodySchema.parse(await request.json())
  } catch {
    return NextResponse.json(
      { ok: false, qaMarker: GROWTH_AIOS_SEND_PLANE_1B_QA_MARKER, error: "invalid_body" },
      { status: 400 },
    )
  }

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, qaMarker: GROWTH_AIOS_SEND_PLANE_1B_QA_MARKER, error: "organization_required" },
      { status: 400 },
    )
  }

  try {
    const approvalPackage = await persistOperatorPackageDraftEdits(access.admin, {
      organizationId,
      packageId,
      leadId: body.leadId,
      operatorUserId: access.userId,
      draftEdits: body.draftEdits,
    })

    if (!approvalPackage) {
      return NextResponse.json(
        { ok: false, qaMarker: GROWTH_AIOS_SEND_PLANE_1B_QA_MARKER, error: "package_not_found" },
        { status: 404 },
      )
    }

    const packet = projectApprovals2AOperatorReviewPacket({
      pkg: approvalPackage,
      teammateName: "Ava",
    })

    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_AIOS_SEND_PLANE_1B_QA_MARKER,
      approvalPackage,
      packet,
      transportBlocked: true,
      pendingHumanApproval: true,
      message: "Operator draft edits persisted to approval package.",
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    const status = detail === "outreach_package_already_decided" ? 409 : 500
    return NextResponse.json(
      { ok: false, qaMarker: GROWTH_AIOS_SEND_PLANE_1B_QA_MARKER, error: detail },
      { status },
    )
  }
}
