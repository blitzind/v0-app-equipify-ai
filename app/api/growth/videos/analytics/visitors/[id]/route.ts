import { NextResponse } from "next/server"
import { growthVideoAnalyticsQuerySchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import {
  createGrowthVideoVisitorService,
  growthVideoVisitorSafetyPayload,
} from "@/lib/growth/videos/growth-video-visitor-service"
import {
  requireGrowthVideoAnalyticsSchemaReady,
  requireGrowthVideoPagesSchemaReady,
  requireGrowthVideoPlatformAccess,
} from "@/lib/growth/videos/growth-video-platform-access"
import { GROWTH_VIDEO_ANALYTICS_QA_MARKER } from "@/lib/growth/videos/growth-video-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const pagesSchemaBlock = await requireGrowthVideoPagesSchemaReady(access)
  if (pagesSchemaBlock) return pagesSchemaBlock

  const analyticsSchemaBlock = await requireGrowthVideoAnalyticsSchemaReady(access)
  if (analyticsSchemaBlock) return analyticsSchemaBlock

  const { id } = await context.params
  const parsed = growthVideoAnalyticsQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const visitorService = createGrowthVideoVisitorService(access.admin)
    const profileResult = await visitorService.getVisitorProfile({
      organizationId: access.organizationId,
      visitorIdentifier: decodeURIComponent(id),
    })
    if (!profileResult.ok) {
      return NextResponse.json({ ok: false, error: profileResult.error }, { status: 400 })
    }

    const timeline = await visitorService.getVisitorTimeline({
      organizationId: access.organizationId,
      visitorIdentifier: decodeURIComponent(id),
      limit: parsed.data.limit ?? 200,
    })
    if (!timeline.ok) {
      return NextResponse.json({ ok: false, error: timeline.error }, { status: 503 })
    }

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        visitor: profileResult.profile,
        sessionIds: profileResult.sessionIds,
        timeline: timeline.items,
        qa_marker: GROWTH_VIDEO_ANALYTICS_QA_MARKER,
        ...growthVideoVisitorSafetyPayload(),
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
