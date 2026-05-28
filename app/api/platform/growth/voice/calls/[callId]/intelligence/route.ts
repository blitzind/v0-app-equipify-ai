import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { fetchVoiceCallConversationIntelligenceSnapshot } from "@/lib/voice/intelligence/intelligence-service"
import { VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER } from "@/lib/voice/intelligence/types"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ callId: string }> }) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { callId } = await context.params
  if (!UUID_RE.test(callId)) return voiceInvalidIdResponse("callId")

  const intelligence = await fetchVoiceCallConversationIntelligenceSnapshot(ctx.admin, ctx.organizationId, callId)

  return NextResponse.json({
    ok: true,
    qaMarker: VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER,
    voiceCallId: callId,
    intelligence,
  })
}
