import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { fetchVoiceMediaCorrelationSnapshot } from "@/lib/voice/media-streaming/media-session-service"
import { VOICE_MEDIA_STREAMING_QA_MARKER } from "@/lib/voice/media-streaming/types"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ callId: string }> }) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { callId } = await context.params
  if (!UUID_RE.test(callId)) return voiceInvalidIdResponse("callId")

  const correlation = await fetchVoiceMediaCorrelationSnapshot(ctx.admin, ctx.organizationId, callId)

  return NextResponse.json({
    ok: true,
    qaMarker: VOICE_MEDIA_STREAMING_QA_MARKER,
    correlation,
  })
}
