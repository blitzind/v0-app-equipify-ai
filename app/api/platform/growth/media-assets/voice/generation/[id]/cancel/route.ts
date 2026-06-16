import { NextResponse } from "next/server"
import { requireMediaAssetPlatformAccess } from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaVoiceGenerationError } from "@/lib/growth/media/media-voice-generation-route-utils"
import {
  cancelGeneration,
  toGrowthMediaVoiceGenerationResponse,
} from "@/lib/growth/media/media-voice-generation-service"
import {
  GROWTH_MEDIA_VOICE_GENERATION_QA_MARKER,
  GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS,
} from "@/lib/growth/media/media-voice-generation-types"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  try {
    const { id } = await context.params
    const record = cancelGeneration(id, access.organizationId)
    return NextResponse.json({
      ...toGrowthMediaVoiceGenerationResponse(record),
      qa_marker: GROWTH_MEDIA_VOICE_GENERATION_QA_MARKER,
      ...GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS,
    })
  } catch (error) {
    return mapMediaVoiceGenerationError(error)
  }
}
