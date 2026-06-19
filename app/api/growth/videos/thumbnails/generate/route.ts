import { NextResponse } from "next/server"
import { growthVideoThumbnailGenerateSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { generateGrowthVideoThumbnailAssets } from "@/lib/growth/videos/growth-video-thumbnail-service"
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
  form: NonNullable<ReturnType<typeof growthVideoThumbnailGenerateSchema.safeParse>["data"]>["preview_form"],
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

export async function POST(request: Request) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const pagesSchemaBlock = await requireGrowthVideoPagesSchemaReady(access)
  if (pagesSchemaBlock) return pagesSchemaBlock

  const parsed = growthVideoThumbnailGenerateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await generateGrowthVideoThumbnailAssets(access.admin, {
      organizationId: access.organizationId,
      pageId: parsed.data.page_id,
      thumbnailType: (parsed.data.thumbnail_type ?? "prospect") as GrowthVideoThumbnailType,
      previewForm: parsePreviewForm(parsed.data.preview_form),
      persist: parsed.data.persist,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        page_id: parsed.data.page_id,
        thumbnail_type: result.metadata.type,
        thumbnail: result.metadata,
        preview: {
          thumbnail_data_url: result.preview.previewDataUrl,
          og_data_url: result.preview.ogPreviewDataUrl,
          layout: result.preview.thumbnail.layout,
        },
        ai_payload: result.aiPayload,
        qa_marker: GROWTH_VIDEO_THUMBNAILS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
