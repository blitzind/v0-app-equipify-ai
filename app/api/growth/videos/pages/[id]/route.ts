import { NextResponse } from "next/server"
import { growthVideoPagePatchSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { createGrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import { buildGrowthVideoPublicPageUrl } from "@/lib/growth/videos/growth-video-public-page-service"
import { createGrowthVideoStorageService } from "@/lib/growth/videos/growth-video-storage-factory"
import { createGrowthVideoService } from "@/lib/growth/videos/growth-video-service"
import {
  requireGrowthVideoPagesSchemaReady,
  requireGrowthVideoPlatformAccess,
} from "@/lib/growth/videos/growth-video-platform-access"
import { GROWTH_VIDEO_PAGES_QA_MARKER } from "@/lib/growth/videos/growth-video-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const pagesSchemaBlock = await requireGrowthVideoPagesSchemaReady(access)
  if (pagesSchemaBlock) return pagesSchemaBlock

  const { id } = await context.params
  try {
    const service = createGrowthVideoPageService(access.admin)
    const page = await service.getPageById({
      organizationId: access.organizationId,
      pageId: id,
    })
    if (!page) return mapGrowthVideoApiError(new Error("not_found"))

    const videoService = createGrowthVideoService(access.admin)
    const asset = await videoService.getAssetById({
      organizationId: access.organizationId,
      assetId: page.videoAssetId,
    })

    let playbackUrl: string | null = null
    let playbackExpiresAt: string | null = null
    if (asset.ok && asset.asset.storagePath && asset.asset.storageProvider) {
      const storageService = createGrowthVideoStorageService(access.admin)
      const playback = await storageService.resolveObjectRef(
        asset.asset.storageProvider,
        asset.asset.storagePath,
      )
      playbackUrl = playback?.signedUrl ?? null
      playbackExpiresAt = (playback?.metadata?.expires_at as string | undefined) ?? null
    }

    const eventCounts = await service.countEventsForPage({
      organizationId: access.organizationId,
      pageId: id,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        page,
        asset: asset.ok ? asset.asset : null,
        playbackUrl,
        playbackExpiresAt,
        publicPath: buildGrowthVideoPublicPageUrl(page.slug),
        eventCounts,
        qa_marker: GROWTH_VIDEO_PAGES_QA_MARKER,
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
  const parsed = growthVideoPagePatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const service = createGrowthVideoPageService(access.admin)
    const page = await service.updatePage({
      organizationId: access.organizationId,
      pageId: id,
      patch: {
        videoAssetId: parsed.data.video_asset_id,
        slug: parsed.data.slug,
        title: parsed.data.title,
        description: parsed.data.description,
        ctaLabel: parsed.data.cta_label,
        ctaUrl: parsed.data.cta_url,
        calendarUrl: parsed.data.calendar_url,
        branding: parsed.data.branding,
        personalization: parsed.data.personalization,
        status: parsed.data.status,
      },
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

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const pagesSchemaBlock = await requireGrowthVideoPagesSchemaReady(access)
  if (pagesSchemaBlock) return pagesSchemaBlock

  const { id } = await context.params
  try {
    const service = createGrowthVideoPageService(access.admin)
    await service.deletePage({ organizationId: access.organizationId, pageId: id })
    return NextResponse.json(growthVideoSafetyJson({ ok: true, qa_marker: GROWTH_VIDEO_PAGES_QA_MARKER }))
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
