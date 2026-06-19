import { NextResponse } from "next/server"
import { growthVideoThumbnailPreviewSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { createGrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import { previewGrowthVideoThumbnail } from "@/lib/growth/videos/growth-video-thumbnail-preview-service"
import {
  resolveGrowthVideoThumbnailMergeValues,
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

function parsePreviewForm(
  form: NonNullable<ReturnType<typeof growthVideoThumbnailPreviewSchema.safeParse>["data"]>["preview_form"],
): GrowthVideoThumbnailPreviewFormInput {
  return {
    firstName: form?.first_name,
    lastName: form?.last_name,
    company: form?.company,
    industry: form?.industry,
    title: form?.title,
    companyLogoUrl: form?.company_logo_url,
    ctaLabel: form?.cta_label,
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const pagesSchemaBlock = await requireGrowthVideoPagesSchemaReady(access)
  if (pagesSchemaBlock) return pagesSchemaBlock

  const parsed = growthVideoThumbnailPreviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const thumbnailType = (parsed.data.thumbnail_type ?? "prospect") as GrowthVideoThumbnailType
    const previewForm = parsePreviewForm(parsed.data.preview_form)

    let page = null
    let sourcesUsed: string[] = ["preview_form", "growth_video_thumbnail_render"]

    if (parsed.data.page_id) {
      const pageService = createGrowthVideoPageService(access.admin)
      page = await pageService.getPageById({
        organizationId: access.organizationId,
        pageId: parsed.data.page_id,
      })
      if (!page) return mapGrowthVideoApiError(new Error("not_found"))

      const merge = await resolveGrowthVideoThumbnailMergeValues(access.admin, {
        organizationId: access.organizationId,
        page,
        previewForm,
      })
      sourcesUsed = merge.sourcesUsed
    }

    const preview = previewGrowthVideoThumbnail({
      type: thumbnailType,
      form: previewForm,
      primaryColor: page?.branding.primaryColor,
      pageTitle: page?.title,
      sourcesUsed,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        page_id: page?.id ?? null,
        thumbnail_type: thumbnailType,
        merge_values: preview.mergeValues,
        sources_used: sourcesUsed,
        preview: {
          thumbnail_data_url: preview.previewDataUrl,
          og_data_url: preview.ogPreviewDataUrl,
          thumbnail_layout: preview.thumbnail.layout,
          og_layout: preview.og.layout,
        },
        ai_payload: preview.aiPayload,
        qa_marker: GROWTH_VIDEO_THUMBNAILS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
