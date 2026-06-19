import { NextResponse } from "next/server"
import { growthSharePageOperatorWorkspaceQuerySchema } from "@/lib/growth/share-pages/share-page-api-schema"
import { getGrowthSharePageOperatorWorkspace } from "@/lib/growth/share-pages/growth-share-page-operator-workspace-service"
import {
  GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_QA_MARKER,
  growthSharePageOperatorWorkspaceSafetyPayload,
} from "@/lib/growth/share-pages/growth-share-page-operator-workspace-types"
import {
  growthSharePageWorkspaceSafetyJson,
  mapGrowthSharePageWorkspaceApiError,
} from "@/lib/growth/share-pages/share-page-workspace-api-utils"
import { requireSharePagePlatformAccess, sharePageOrigin } from "@/lib/growth/share-pages/share-page-platform-access"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireSharePagePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = growthSharePageOperatorWorkspaceQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const workspace = await getGrowthSharePageOperatorWorkspace(access.admin, {
      organizationId: access.organizationId,
      sharePageId: id,
      origin: sharePageOrigin(request),
    })
    if (!workspace || workspace.leadId !== parsed.data.lead_id) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    }

    return NextResponse.json(
      growthSharePageWorkspaceSafetyJson({
        ok: true,
        workspace,
        qa_marker: GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_QA_MARKER,
        ...growthSharePageOperatorWorkspaceSafetyPayload(),
      }),
    )
  } catch (error) {
    return mapGrowthSharePageWorkspaceApiError(error)
  }
}
