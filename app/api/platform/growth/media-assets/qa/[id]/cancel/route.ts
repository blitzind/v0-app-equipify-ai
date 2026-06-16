import { NextResponse } from "next/server"
import { requireMediaAssetPlatformAccess } from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaAiQaError } from "@/lib/growth/media/media-ai-qa-route-utils"
import { cancelQaSession, toGrowthMediaAiQaResponse } from "@/lib/growth/media/media-ai-qa-service"
import {
  GROWTH_MEDIA_AI_QA_QA_MARKER,
  GROWTH_MEDIA_AI_QA_SAFETY_FLAGS,
} from "@/lib/growth/media/media-ai-qa-types"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  try {
    const { id } = await context.params
    const record = cancelQaSession(id, access.organizationId)
    return NextResponse.json({
      ...toGrowthMediaAiQaResponse(record),
      qa_marker: GROWTH_MEDIA_AI_QA_QA_MARKER,
      ...GROWTH_MEDIA_AI_QA_SAFETY_FLAGS,
    })
  } catch (error) {
    return mapMediaAiQaError(error)
  }
}
