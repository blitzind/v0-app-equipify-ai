import { NextResponse } from "next/server"
import { growthVideoPageThumbnailPatchSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import {
  generateGrowthVideoThumbnailAssets,
  getGrowthVideoPageThumbnailState,
  patchGrowthVideoPageThumbnailConfig,
} from "@/lib/growth/videos/growth-video-thumbnail-service"
import {
  requireGrowthVideoPagesSchemaReady,
  requireGrowthVideoPlatformAccess,
} from "@/lib/growth/videos/growth-video-platform-access"
import {
  GROWTH_VIDEO_THUMBNAILS_QA_MARKER,
  type GrowthVideoThumbnailPreviewFormInput,
  type GrowthVideoThumbnailType,
} from "@/lib/growth/videos/growth-video-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

function parsePreviewForm(
  form: NonNullable<ReturnType<typeof growthVideoPageThumbnailPatchSchema.safeParse>["data"]>["preview_form"],
): GrowthVideoThumbnailPreviewFormInput | undefined {
  if (!form) return undefined
  return {
    firstName: form.first_name,
    lastName: form.last_name,
    company: form.company,
    industry: form.industry,
    title: form.title,
    companyLogoUrl: form.company_logo_url,
    ctaLabel: form.cta_label,
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const pagesSchemaBlock = await requireGrowthVideoPagesSchemaReady(access)
  if (pagesSchemaBlock) return pagesSchemaBlock

  const { id } = await context.params
  try {
    const state = await getGrowthVideoPageThumbnailState(access.admin, {
      organizationId: access.organizationId,
      pageId: id,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        page_id: state.page.id,
        video_asset_id: state.page.videoAssetId,
        thumbnail: state.thumbnail,
        ai_payload: state.aiPayload,
        qa_marker: GROWTH_VIDEO_THUMBNAILS_QA_MARKER,
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
  const parsed = growthVideoPageThumbnailPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const previewForm = parsePreviewForm(parsed.data.preview_form)
    const thumbnailType = parsed.data.thumbnail_type as GrowthVideoThumbnailType | undefined

    await patchGrowthVideoPageThumbnailConfig(access.admin, {
      organizationId: access.organizationId,
      pageId: id,
      thumbnailType,
      previewForm,
    })

    const result = await generateGrowthVideoThumbnailAssets(access.admin, {
      organizationId: access.organizationId,
      pageId: id,
      thumbnailType: thumbnailType ?? "prospect",
      previewForm,
      persist: true,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        page_id: id,
        thumbnail: result.metadata,
        ai_payload: result.aiPayload,
        preview: {
          thumbnail_data_url: result.preview.previewDataUrl,
          og_data_url: result.preview.ogPreviewDataUrl,
        },
        qa_marker: GROWTH_VIDEO_THUMBNAILS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
