import { NextResponse } from "next/server"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { createGrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import {
  requireGrowthVideoPagesSchemaReady,
  requireGrowthVideoPlatformAccess,
} from "@/lib/growth/videos/growth-video-platform-access"
import { GROWTH_VIDEO_PAGES_QA_MARKER } from "@/lib/growth/videos/growth-video-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const pagesSchemaBlock = await requireGrowthVideoPagesSchemaReady(access)
  if (pagesSchemaBlock) return pagesSchemaBlock

  const { id } = await context.params
  try {
    const service = createGrowthVideoPageService(access.admin)
    const page = await service.archivePage({
      organizationId: access.organizationId,
      pageId: id,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        page,
        qa_marker: GROWTH_VIDEO_PAGES_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
