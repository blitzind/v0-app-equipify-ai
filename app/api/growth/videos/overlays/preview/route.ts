import { NextResponse } from "next/server"
import { growthVideoOverlayPreviewSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { createGrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import { normalizeGrowthVideoOverlayConfig } from "@/lib/growth/videos/growth-video-overlay-render-service"
import { previewGrowthVideoPageOverlays } from "@/lib/growth/videos/growth-video-overlay-service"
import {
  requireGrowthVideoPagesSchemaReady,
  requireGrowthVideoPlatformAccess,
} from "@/lib/growth/videos/growth-video-platform-access"
import {
  GROWTH_VIDEO_OVERLAYS_QA_MARKER,
  type GrowthVideoOverlayPreviewFormInput,
} from "@/lib/growth/videos/growth-video-types"

export const runtime = "nodejs"

function parsePreviewForm(
  form: NonNullable<ReturnType<typeof growthVideoOverlayPreviewSchema.safeParse>["data"]>["preview_form"],
): GrowthVideoOverlayPreviewFormInput {
  return {
    firstName: form?.first_name,
    lastName: form?.last_name,
    company: form?.company,
    industry: form?.industry,
    title: form?.title,
    senderName: form?.sender_name,
    senderCompany: form?.sender_company,
    ctaLabel: form?.cta_label,
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const pagesSchemaBlock = await requireGrowthVideoPagesSchemaReady(access)
  if (pagesSchemaBlock) return pagesSchemaBlock

  const parsed = growthVideoOverlayPreviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    let page = null
    if (parsed.data.page_id) {
      const pageService = createGrowthVideoPageService(access.admin)
      page = await pageService.getPageById({
        organizationId: access.organizationId,
        pageId: parsed.data.page_id,
      })
      if (!page) return mapGrowthVideoApiError(new Error("not_found"))
    }

    const config = normalizeGrowthVideoOverlayConfig(
      parsed.data.overlays ?? { enabled: false, items: [] },
    )
    const previewForm = parsePreviewForm(parsed.data.preview_form)

    const result = await previewGrowthVideoPageOverlays(access.admin, {
      organizationId: access.organizationId,
      page,
      config,
      previewForm,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        page_id: page?.id ?? null,
        merge_values: result.mergeValues,
        missing_variables: result.missingVariables,
        branding_preview: result.brandingPreview,
        preview_items: result.previewItems,
        ai_payload: result.aiPayload,
        qa_marker: GROWTH_VIDEO_OVERLAYS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
