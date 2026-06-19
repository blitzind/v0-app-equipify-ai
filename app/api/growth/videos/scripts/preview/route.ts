import { NextResponse } from "next/server"
import { growthVideoScriptPreviewSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { createGrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import { previewGrowthVideoScriptGeneration } from "@/lib/growth/videos/growth-video-script-generation-service"
import { buildGrowthVideoScriptPreviewPrompt } from "@/lib/growth/videos/growth-video-script-prompt-service"
import {
  requireGrowthVideoPagesSchemaReady,
  requireGrowthVideoPlatformAccess,
} from "@/lib/growth/videos/growth-video-platform-access"
import {
  GROWTH_VIDEO_SCRIPTS_QA_MARKER,
  type GrowthVideoScriptGenerationInput,
} from "@/lib/growth/videos/growth-video-types"

export const runtime = "nodejs"

function parseGenerationInput(
  body: NonNullable<ReturnType<typeof growthVideoScriptPreviewSchema.safeParse>["data"]>,
): GrowthVideoScriptGenerationInput {
  return {
    videoPageId: body.video_page_id ?? null,
    videoAssetId: body.video_asset_id ?? null,
    leadId: body.lead_id ?? null,
    companyCandidateId: body.company_candidate_id ?? null,
    personCandidateId: body.person_candidate_id ?? null,
    personalizationProfileId: body.personalization_profile_id ?? null,
    sequenceCandidateId: body.sequence_candidate_id ?? null,
    goal: body.goal ?? null,
    targetPersona: body.target_persona ?? null,
    painPoint: body.pain_point ?? null,
    offer: body.offer ?? null,
    cta: body.cta ?? null,
    tone: body.tone ?? null,
    lengthSeconds: body.length_seconds ?? null,
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const pagesSchemaBlock = await requireGrowthVideoPagesSchemaReady(access)
  if (pagesSchemaBlock) return pagesSchemaBlock

  const parsed = growthVideoScriptPreviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    let page = null
    if (parsed.data.video_page_id) {
      const pageService = createGrowthVideoPageService(access.admin)
      page = await pageService.getPageById({
        organizationId: access.organizationId,
        pageId: parsed.data.video_page_id,
      })
      if (!page) return mapGrowthVideoApiError(new Error("not_found"))
    }

    const generationInput = parseGenerationInput(parsed.data)
    const result = await previewGrowthVideoScriptGeneration(access.admin, {
      organizationId: access.organizationId,
      generationInput,
      page,
    })

    const promptPreview = buildGrowthVideoScriptPreviewPrompt({
      generationInput,
      previewContext: result.previewContext,
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        page_id: page?.id ?? null,
        preview_context: {
          ...result.previewContext,
          promptPreview,
        },
        fallback_script: result.fallbackScript,
        ai_payload: result.aiPayload,
        qa_marker: GROWTH_VIDEO_SCRIPTS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
