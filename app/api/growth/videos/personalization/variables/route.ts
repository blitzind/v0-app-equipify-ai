import { NextResponse } from "next/server"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { listGrowthVideoPersonalizationVariables } from "@/lib/growth/videos/growth-video-personalization-service"
import {
  requireGrowthVideoPagesSchemaReady,
  requireGrowthVideoPlatformAccess,
} from "@/lib/growth/videos/growth-video-platform-access"
import {
  GROWTH_VIDEO_PERSONALIZATION_QA_MARKER,
} from "@/lib/growth/videos/growth-video-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const pagesSchemaBlock = await requireGrowthVideoPagesSchemaReady(access)
  if (pagesSchemaBlock) return pagesSchemaBlock

  try {
    const summary = await listGrowthVideoPersonalizationVariables(access.admin)
    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        ...summary,
        qa_marker: GROWTH_VIDEO_PERSONALIZATION_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
