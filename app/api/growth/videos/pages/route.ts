import { NextResponse } from "next/server"
import { growthVideoPageCreateSchema, growthVideoPageListQuerySchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { createGrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import { buildGrowthVideoPublicPageUrl } from "@/lib/growth/videos/growth-video-public-page-service"
import {
  requireGrowthVideoPagesSchemaReady,
  requireGrowthVideoPlatformAccess,
} from "@/lib/growth/videos/growth-video-platform-access"
import { GROWTH_VIDEO_PAGES_QA_MARKER } from "@/lib/growth/videos/growth-video-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const pagesSchemaBlock = await requireGrowthVideoPagesSchemaReady(access)
  if (pagesSchemaBlock) return pagesSchemaBlock

  const parsed = growthVideoPageListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const service = createGrowthVideoPageService(access.admin)
    const items = await service.listPages({
      organizationId: access.organizationId,
      status: parsed.data.status,
      search: parsed.data.search,
      limit: parsed.data.limit,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        items,
        qa_marker: GROWTH_VIDEO_PAGES_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const pagesSchemaBlock = await requireGrowthVideoPagesSchemaReady(access)
  if (pagesSchemaBlock) return pagesSchemaBlock

  const parsed = growthVideoPageCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const service = createGrowthVideoPageService(access.admin)
    const page = await service.createPage({
      organizationId: access.organizationId,
      createdBy: access.userId,
      videoAssetId: parsed.data.video_asset_id,
      slug: parsed.data.slug,
      title: parsed.data.title,
      description: parsed.data.description,
      ctaLabel: parsed.data.cta_label,
      ctaUrl: parsed.data.cta_url,
      calendarUrl: parsed.data.calendar_url,
      branding: parsed.data.branding ?? {},
      personalization: parsed.data.personalization ?? {},
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        page,
        publicPath: buildGrowthVideoPublicPageUrl(page.slug),
        qa_marker: GROWTH_VIDEO_PAGES_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
