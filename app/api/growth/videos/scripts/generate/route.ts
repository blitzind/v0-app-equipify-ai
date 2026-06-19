import { NextResponse } from "next/server"
import { growthVideoScriptGenerationSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { generateGrowthVideoScript } from "@/lib/growth/videos/growth-video-script-generation-service"
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
  body: NonNullable<ReturnType<typeof growthVideoScriptGenerationSchema.safeParse>["data"]>,
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

  const parsed = growthVideoScriptGenerationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await generateGrowthVideoScript(access.admin, {
      organizationId: access.organizationId,
      generationInput: parseGenerationInput(parsed.data),
      persist: parsed.data.persist ?? Boolean(parsed.data.video_page_id),
    })

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        generated_script: result.output,
        ai_payload: result.aiPayload,
        provider: result.provider,
        model: result.model,
        version: result.version,
        metadata: result.metadata,
        qa_marker: GROWTH_VIDEO_SCRIPTS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
