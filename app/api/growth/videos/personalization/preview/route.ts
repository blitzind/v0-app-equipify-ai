import { NextResponse } from "next/server"
import { growthVideoPersonalizationPreviewSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { createGrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import { previewGrowthVideoPersonalization } from "@/lib/growth/videos/growth-video-personalization-service"
import {
  requireGrowthVideoPagesSchemaReady,
  requireGrowthVideoPlatformAccess,
} from "@/lib/growth/videos/growth-video-platform-access"
import { GROWTH_VIDEO_PERSONALIZATION_QA_MARKER } from "@/lib/growth/videos/growth-video-types"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const pagesSchemaBlock = await requireGrowthVideoPagesSchemaReady(access)
  if (pagesSchemaBlock) return pagesSchemaBlock

  const parsed = growthVideoPersonalizationPreviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    let page = null
    if (parsed.data.page_id) {
      const service = createGrowthVideoPageService(access.admin)
      page = await service.getPageById({
        organizationId: access.organizationId,
        pageId: parsed.data.page_id,
      })
      if (!page) return mapGrowthVideoApiError(new Error("not_found"))
    }

    const form = parsed.data.preview_form ?? {}
    const result = await previewGrowthVideoPersonalization(access.admin, {
      organizationId: access.organizationId,
      page,
      previewForm: {
        firstName: form.first_name,
        lastName: form.last_name,
        company: form.company,
        title: form.title,
        industry: form.industry,
        city: form.city,
        state: form.state,
      },
      sampleText: parsed.data.sample_text ?? null,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        variables: result.mergeContext.variables,
        aliases: result.mergeContext.aliases,
        missing: result.mergeContext.missing,
        sources_used: result.mergeContext.sourcesUsed,
        rendered_preview: result.renderedPreview,
        rendered_sample_text: result.renderedSampleText,
        ai_payload: result.aiPayload,
        qa_marker: GROWTH_VIDEO_PERSONALIZATION_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
