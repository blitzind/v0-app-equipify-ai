import { NextResponse } from "next/server"
import { growthVideoPageScriptPatchSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import {
  getGrowthVideoPageScriptState,
  patchGrowthVideoPageScripts,
} from "@/lib/growth/videos/growth-video-script-generation-service"
import {
  requireGrowthVideoPagesSchemaReady,
  requireGrowthVideoPlatformAccess,
} from "@/lib/growth/videos/growth-video-platform-access"
import { GROWTH_VIDEO_SCRIPTS_QA_MARKER } from "@/lib/growth/videos/growth-video-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const pagesSchemaBlock = await requireGrowthVideoPagesSchemaReady(access)
  if (pagesSchemaBlock) return pagesSchemaBlock

  const { id } = await context.params
  try {
    const state = await getGrowthVideoPageScriptState(access.admin, {
      organizationId: access.organizationId,
      pageId: id,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        page_id: state.page.id,
        metadata: state.metadata,
        current_version: state.currentVersion,
        qa_marker: GROWTH_VIDEO_SCRIPTS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const pagesSchemaBlock = await requireGrowthVideoPagesSchemaReady(access)
  if (pagesSchemaBlock) return pagesSchemaBlock

  const { id } = await context.params
  const parsed = growthVideoPageScriptPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await patchGrowthVideoPageScripts(access.admin, {
      organizationId: access.organizationId,
      pageId: id,
      currentVersionId: parsed.data.current_version_id,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        page_id: id,
        metadata: result.metadata,
        current_version: result.currentVersion,
        qa_marker: GROWTH_VIDEO_SCRIPTS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
