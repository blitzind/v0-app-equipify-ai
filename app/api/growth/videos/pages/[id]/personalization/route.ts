import { NextResponse } from "next/server"
import { growthVideoPagePersonalizationPatchSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { createGrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import { parseGrowthVideoPagePersonalization } from "@/lib/growth/videos/growth-video-page-validation"
import {
  buildGrowthVideoAiPayload,
  extractSequenceHooks,
  listGrowthVideoPersonalizationVariables,
  renderGrowthVideoPageFields,
} from "@/lib/growth/videos/growth-video-personalization-service"
import {
  requireGrowthVideoPagesSchemaReady,
  requireGrowthVideoPlatformAccess,
} from "@/lib/growth/videos/growth-video-platform-access"
import { GROWTH_VIDEO_PERSONALIZATION_QA_MARKER } from "@/lib/growth/videos/growth-video-types"
import { renderGrowthVideoPreviewFields } from "@/lib/growth/videos/growth-video-preview-render-service"

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

    const variableSummary = await listGrowthVideoPersonalizationVariables(access.admin)
    const mergeContextInput = {
      organizationId: access.organizationId,
      leadId: extractSequenceHooks(page.metadata).lead_id ?? null,
      companyCandidateId: extractSequenceHooks(page.metadata).company_candidate_id ?? null,
      personCandidateId: extractSequenceHooks(page.metadata).person_candidate_id ?? null,
      pagePersonalization: page.personalization,
    }

    const rendered = await renderGrowthVideoPageFields(
      access.admin,
      mergeContextInput,
      {
        title: page.title,
        description: page.description,
        ctaLabel: page.ctaLabel,
        ctaUrl: page.ctaUrl,
        calendarUrl: page.calendarUrl,
        branding: page.branding,
      },
    )

    const renderedPreview = renderGrowthVideoPreviewFields({
      title: rendered.title,
      description: rendered.description,
      ctaLabel: rendered.ctaLabel,
      ctaUrl: rendered.ctaUrl,
      calendarUrl: rendered.calendarUrl,
      buttonLabelOverride: rendered.branding.buttonLabelOverride ?? null,
      mergeValues: rendered.mergeContext.variables,
    })

    const aiPayload = buildGrowthVideoAiPayload({
      mergeContext: rendered.mergeContext,
      renderedPreview,
      sequenceHooks: extractSequenceHooks(page.metadata),
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        page_id: page.id,
        personalization: page.personalization,
        metadata_hooks: extractSequenceHooks(page.metadata),
        registry_variables: variableSummary.registryVariables,
        legacy_aliases: variableSummary.legacyAliases,
        resolved_values: rendered.mergeContext.variables,
        aliases: rendered.mergeContext.aliases,
        missing_variables: rendered.missingVariables,
        sources_used: rendered.mergeContext.sourcesUsed,
        rendered_preview: renderedPreview,
        ai_payload: aiPayload,
        qa_marker: GROWTH_VIDEO_PERSONALIZATION_QA_MARKER,
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
  const parsed = growthVideoPagePersonalizationPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const service = createGrowthVideoPageService(access.admin)
    const existing = await service.getPageById({
      organizationId: access.organizationId,
      pageId: id,
    })
    if (!existing) return mapGrowthVideoApiError(new Error("not_found"))

    const metadataPatch: Record<string, unknown> = {}
    if (parsed.data.metadata) {
      for (const [key, value] of Object.entries(parsed.data.metadata)) {
        if (value === null) metadataPatch[key] = null
        else if (value !== undefined) metadataPatch[key] = value
      }
    }

    const personalization = parsed.data.personalization
      ? parseGrowthVideoPagePersonalization(parsed.data.personalization)
      : undefined

    const page = await service.updatePage({
      organizationId: access.organizationId,
      pageId: id,
      patch: {
        personalization,
        metadata: Object.keys(metadataPatch).length ? metadataPatch : undefined,
      },
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        page,
        metadata_hooks: extractSequenceHooks(page.metadata),
        qa_marker: GROWTH_VIDEO_PERSONALIZATION_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
