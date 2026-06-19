import { NextResponse } from "next/server"
import { growthAiVoiceJobActionSchema } from "@/lib/growth/media/growth-ai-voice-generation-api-schema"
import { cancelGrowthAiVoiceGenerationJob } from "@/lib/growth/media/growth-ai-voice-generation-service"
import { GROWTH_AI_VOICE_GENERATION_QA_MARKER } from "@/lib/growth/media/growth-ai-voice-generation-types"
import { growthAiVoiceSafetyJson } from "@/lib/growth/media/growth-ai-voice-generation-api-utils"
import {
  mapGrowthMediaGenerationApiError,
  requireGrowthMediaGenerationPlatformAccess,
} from "@/lib/growth/media/growth-media-generation-platform-access"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthMediaGenerationPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = growthAiVoiceJobActionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const job = await cancelGrowthAiVoiceGenerationJob(access.admin, {
      organizationId: access.organizationId,
      runId: id,
      reason: parsed.data.reason ?? null,
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
