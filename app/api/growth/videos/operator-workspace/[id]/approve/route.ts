import { NextResponse } from "next/server"
import { growthVideoOperatorWorkspaceApproveSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import {
  approveGrowthVideoOperatorAttachment,
  approveGrowthVideoOperatorDraft,
} from "@/lib/growth/videos/growth-video-operator-actions-service"
import {
  GROWTH_VIDEO_OPERATOR_WORKSPACE_QA_MARKER,
  growthVideoOperatorWorkspaceSafetyPayload,
} from "@/lib/growth/videos/growth-video-operator-workspace-types"
import { requireGrowthVideoPlatformAccess } from "@/lib/growth/videos/growth-video-platform-access"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = growthVideoOperatorWorkspaceApproveSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const workspace =
      parsed.data.scope === "attachment"
        ? await approveGrowthVideoOperatorAttachment(access.admin, {
            organizationId: access.organizationId,
            leadId: parsed.data.lead_id,
            draftId: id,
            actorUserId: access.userId,
          })
        : await approveGrowthVideoOperatorDraft(access.admin, {
            organizationId: access.organizationId,
            leadId: parsed.data.lead_id,
            draftId: id,
            actorUserId: access.userId,
          })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        workspace,
        qa_marker: GROWTH_VIDEO_OPERATOR_WORKSPACE_QA_MARKER,
        ...growthVideoOperatorWorkspaceSafetyPayload(),
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
