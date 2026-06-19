import { NextResponse } from "next/server"
import { growthVideoOperatorWorkspaceListQuerySchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { listGrowthVideoOperatorWorkspaces } from "@/lib/growth/videos/growth-video-operator-workspace-service"
import {
  GROWTH_VIDEO_OPERATOR_WORKSPACE_QA_MARKER,
  growthVideoOperatorWorkspaceSafetyPayload,
} from "@/lib/growth/videos/growth-video-operator-workspace-types"
import { requireGrowthVideoPlatformAccess } from "@/lib/growth/videos/growth-video-platform-access"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthVideoOperatorWorkspaceListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const workspaces = await listGrowthVideoOperatorWorkspaces(access.admin, {
      organizationId: access.organizationId,
      leadId: parsed.data.lead_id,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        workspaces,
        qa_marker: GROWTH_VIDEO_OPERATOR_WORKSPACE_QA_MARKER,
        ...growthVideoOperatorWorkspaceSafetyPayload(),
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
