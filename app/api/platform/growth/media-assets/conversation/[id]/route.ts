import { NextResponse } from "next/server"
import { requireMediaAssetPlatformAccess } from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaConversationalSessionError } from "@/lib/growth/media/media-conversational-session-route-utils"
import {
  getConversationStatus,
  toGrowthMediaConversationalSessionResponse,
} from "@/lib/growth/media/media-conversational-session-service"
import {
  GROWTH_MEDIA_CONVERSATIONAL_SESSION_QA_MARKER,
  GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS,
} from "@/lib/growth/media/media-conversational-session-types"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  try {
    const { id } = await context.params
    const record = getConversationStatus(id, access.organizationId)
    return NextResponse.json({
      ...toGrowthMediaConversationalSessionResponse(record),
      qa_marker: GROWTH_MEDIA_CONVERSATIONAL_SESSION_QA_MARKER,
      ...GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS,
    })
  } catch (error) {
    return mapMediaConversationalSessionError(error)
  }
}
