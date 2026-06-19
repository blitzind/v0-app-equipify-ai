import { NextResponse } from "next/server"
import { growthSharePageOperatorWorkspaceListQuerySchema } from "@/lib/growth/share-pages/share-page-api-schema"
import { listGrowthSharePageOperatorWorkspaces } from "@/lib/growth/share-pages/growth-share-page-operator-workspace-service"
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

export async function GET(request: Request) {
  const access = await requireSharePagePlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthSharePageOperatorWorkspaceListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const workspaces = await listGrowthSharePageOperatorWorkspaces(access.admin, {
      organizationId: access.organizationId,
      leadId: parsed.data.lead_id ?? null,
    })

    let filtered = workspaces
    if (parsed.data.page_id) {
      filtered = workspaces.filter((item) => item.id === parsed.data.page_id)
    }

    return NextResponse.json(
      growthSharePageWorkspaceSafetyJson({
        ok: true,
        workspaces: filtered,
        origin: sharePageOrigin(request),
        qa_marker: GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_QA_MARKER,
        ...growthSharePageOperatorWorkspaceSafetyPayload(),
      }),
    )
  } catch (error) {
    return mapGrowthSharePageWorkspaceApiError(error)
  }
}
