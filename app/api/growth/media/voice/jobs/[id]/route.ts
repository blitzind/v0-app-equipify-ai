import { NextResponse } from "next/server"
import { getGrowthAiVoiceGenerationJob } from "@/lib/growth/media/growth-ai-voice-generation-service"
import { GROWTH_AI_VOICE_GENERATION_QA_MARKER } from "@/lib/growth/media/growth-ai-voice-generation-types"
import { growthAiVoiceSafetyJson } from "@/lib/growth/media/growth-ai-voice-generation-api-utils"
import {
  mapGrowthMediaGenerationApiError,
  requireGrowthMediaGenerationPlatformAccess,
} from "@/lib/growth/media/growth-media-generation-platform-access"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthMediaGenerationPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  try {
    const job = await getGrowthAiVoiceGenerationJob(access.admin, {
      organizationId: access.organizationId,
      runId: id,
    })
    if (!job) return mapGrowthMediaGenerationApiError(new Error("not_found"))

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
