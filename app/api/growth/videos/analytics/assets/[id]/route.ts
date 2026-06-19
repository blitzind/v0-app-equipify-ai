import { NextResponse } from "next/server"
import { growthVideoAnalyticsQuerySchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import {
  createGrowthVideoAnalyticsSummaryService,
  growthVideoAnalyticsSummarySafetyPayload,
} from "@/lib/growth/videos/growth-video-analytics-summary-service"
import { createGrowthVideoEngagementTimelineService } from "@/lib/growth/videos/growth-video-engagement-timeline-service"
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
    const filters = {
      organizationId: access.organizationId,
      videoAssetId: id,
      since: parsed.data.since,
      until: parsed.data.until,
    }

    const summaryService = createGrowthVideoAnalyticsSummaryService(access.admin)
    const summaries = await summaryService.listSummaries(filters)
    const overview = await summaryService.buildOverview(filters)
    const watchDistribution = summaryService.buildWatchDistribution(summaries)
    const engagementScoreDistribution = summaryService.buildEngagementScoreDistribution(summaries)

    const timelineService = createGrowthVideoEngagementTimelineService(access.admin)
    const timeline = await timelineService.listTimeline({
      organizationId: access.organizationId,
      videoAssetId: id,
      limit: parsed.data.limit ?? 100,
    })
    if (!timeline.ok) {
      return NextResponse.json({ ok: false, error: timeline.error }, { status: 503 })
    }

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        videoAssetId: id,
        overview,
        watchDistribution,
        engagementScoreDistribution,
        timeline: timeline.items,
        qa_marker: GROWTH_VIDEO_ANALYTICS_QA_MARKER,
        ...growthVideoAnalyticsSummarySafetyPayload(),
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
