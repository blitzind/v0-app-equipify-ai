import { NextResponse } from "next/server"
import { growthVideoPageOverlayPatchSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import {
  getGrowthVideoPageOverlayState,
  patchGrowthVideoPageOverlayConfig,
} from "@/lib/growth/videos/growth-video-overlay-service"
import { normalizeGrowthVideoOverlayConfig } from "@/lib/growth/videos/growth-video-overlay-render-service"
import {
  requireGrowthVideoPagesSchemaReady,
  requireGrowthVideoPlatformAccess,
} from "@/lib/growth/videos/growth-video-platform-access"
import {
  GROWTH_VIDEO_OVERLAYS_QA_MARKER,
  type GrowthVideoOverlayPreviewFormInput,
} from "@/lib/growth/videos/growth-video-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

function parsePreviewForm(
  form: NonNullable<ReturnType<typeof growthVideoPageOverlayPatchSchema.safeParse>["data"]>["preview_form"],
): GrowthVideoOverlayPreviewFormInput | undefined {
  if (!form) return undefined
  return {
    firstName: form.first_name,
    lastName: form.last_name,
    company: form.company,
    industry: form.industry,
    title: form.title,
    senderName: form.sender_name,
    senderCompany: form.sender_company,
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
    const state = await getGrowthVideoPageOverlayState(access.admin, {
      organizationId: access.organizationId,
      pageId: id,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        page_id: state.page.id,
        overlays: state.config,
        ai_payload: state.aiPayload,
        qa_marker: GROWTH_VIDEO_OVERLAYS_QA_MARKER,
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
  const parsed = growthVideoPageOverlayPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const existing = await getGrowthVideoPageOverlayState(access.admin, {
      organizationId: access.organizationId,
      pageId: id,
    })

    const nextConfig = normalizeGrowthVideoOverlayConfig({
      enabled: parsed.data.enabled ?? existing.config.enabled,
      items: parsed.data.items ?? existing.config.items,
      branding: parsed.data.branding ?? existing.config.branding,
    })

    const result = await patchGrowthVideoPageOverlayConfig(access.admin, {
      organizationId: access.organizationId,
      pageId: id,
      config: nextConfig,
      previewForm: parsePreviewForm(parsed.data.preview_form),
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        page_id: id,
        overlays: result.config,
        preview_items: result.previewItems,
        ai_payload: result.aiPayload,
        qa_marker: GROWTH_VIDEO_OVERLAYS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
