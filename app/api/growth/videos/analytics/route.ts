import { NextResponse } from "next/server"
import { growthVideoAnalyticsQuerySchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import {
  createGrowthVideoAnalyticsSummaryService,
  growthVideoAnalyticsSummarySafetyPayload,
} from "@/lib/growth/videos/growth-video-analytics-summary-service"
import {
  requireGrowthVideoAnalyticsSchemaReady,
  requireGrowthVideoPagesSchemaReady,
  requireGrowthVideoPlatformAccess,
} from "@/lib/growth/videos/growth-video-platform-access"
import { GROWTH_VIDEO_ANALYTICS_QA_MARKER } from "@/lib/growth/videos/growth-video-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const pagesSchemaBlock = await requireGrowthVideoPagesSchemaReady(access)
  if (pagesSchemaBlock) return pagesSchemaBlock

  const analyticsSchemaBlock = await requireGrowthVideoAnalyticsSchemaReady(access)
  if (analyticsSchemaBlock) return analyticsSchemaBlock

  const parsed = growthVideoAnalyticsQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const service = createGrowthVideoAnalyticsSummaryService(access.admin)
    const filters = {
      organizationId: access.organizationId,
      videoAssetId: parsed.data.video_asset_id,
      videoPageId: parsed.data.video_page_id,
      visitorIdentifier: parsed.data.visitor_identifier,
      since: parsed.data.since,
      until: parsed.data.until,
    }

    const summaries = await service.listSummaries(filters)
    const overview = await service.buildOverview(filters)
    const viewsOverTime = await service.buildViewsOverTime(filters)
    const watchDistribution = service.buildWatchDistribution(summaries)
    const engagementScoreDistribution = service.buildEngagementScoreDistribution(summaries)
    const topVideos = await service.buildTopAssets(filters)
    const topPages = await service.buildTopPages(filters)

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        overview,
        viewsOverTime,
        watchDistribution,
        engagementScoreDistribution,
        topVideos,
        topPages,
        qa_marker: GROWTH_VIDEO_ANALYTICS_QA_MARKER,
        ...growthVideoAnalyticsSummarySafetyPayload(),
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
