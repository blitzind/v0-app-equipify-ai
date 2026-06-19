import { NextResponse } from "next/server"
import { growthSharePageOperatorWorkspaceActionSchema } from "@/lib/growth/share-pages/share-page-api-schema"
import { rebuildGrowthSharePageOperatorPersonalization } from "@/lib/growth/share-pages/growth-share-page-operator-actions-service"
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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireSharePagePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = growthSharePageOperatorWorkspaceActionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const workspace = await rebuildGrowthSharePageOperatorPersonalization(access.admin, {
      organizationId: access.organizationId,
      sharePageId: id,
      leadId: parsed.data.lead_id,
      origin: sharePageOrigin(request),
    })

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
