import { NextResponse } from "next/server"
import { growthAiVoiceGenerateSchema } from "@/lib/growth/media/growth-ai-voice-generation-api-schema"
import { createGrowthAiVoiceGenerationJob } from "@/lib/growth/media/growth-ai-voice-generation-service"
import { GROWTH_AI_VOICE_GENERATION_QA_MARKER } from "@/lib/growth/media/growth-ai-voice-generation-types"
import { mapGeV13ProspectFromApiBody } from "@/lib/growth/media/ge-v1-3-api-utils"
import {
  mapGrowthMediaGenerationApiError,
  requireGrowthMediaGenerationPlatformAccess,
} from "@/lib/growth/media/growth-media-generation-platform-access"
import { growthAiVoiceSafetyJson } from "@/lib/growth/media/growth-ai-voice-generation-api-utils"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthMediaGenerationPlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthAiVoiceGenerateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const job = await createGrowthAiVoiceGenerationJob(access.admin, {
      organizationId: access.organizationId,
      createdBy: access.userId,
      generation: {
        videoPageId: parsed.data.video_page_id,
        scriptVersionId: parsed.data.script_version_id ?? null,
        voiceId: parsed.data.voice_id,
        provider: parsed.data.provider ?? "elevenlabs",
        settings: parsed.data.settings,
        dryRun: parsed.data.dry_run,
        prospect: mapGeV13ProspectFromApiBody(parsed.data),
      },
    })

    return NextResponse.json(
      growthAiVoiceSafetyJson({
        ok: true,
        job,
        qa_marker: GROWTH_AI_VOICE_GENERATION_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthMediaGenerationApiError(error)
  }
}
