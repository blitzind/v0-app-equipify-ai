import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { fetchVoiceCallTranscriptSnapshot } from "@/lib/voice/media-streaming/media-session-service"
import { VOICE_MEDIA_STREAMING_QA_MARKER } from "@/lib/voice/media-streaming/types"

export const runtime = "nodejs"

export async function GET(request: Request, context: { params: Promise<{ callId: string }> }) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { callId } = await context.params
  if (!UUID_RE.test(callId)) return voiceInvalidIdResponse("callId")

  const url = new URL(request.url)
  const afterSequenceRaw = url.searchParams.get("afterSequenceNumber")
  const afterSequenceNumber =
    afterSequenceRaw != null && afterSequenceRaw !== "" ? Number.parseInt(afterSequenceRaw, 10) : null

  const snapshot = await fetchVoiceCallTranscriptSnapshot(
    ctx.admin,
    ctx.organizationId,
    callId,
    Number.isFinite(afterSequenceNumber) ? afterSequenceNumber : null,
  )

  return NextResponse.json({
    ok: true,
    qaMarker: VOICE_MEDIA_STREAMING_QA_MARKER,
    voiceCallId: callId,
    transcript: snapshot,
  })
}
