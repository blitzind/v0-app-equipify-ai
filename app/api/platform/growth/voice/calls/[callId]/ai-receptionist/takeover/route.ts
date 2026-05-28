import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { operatorTakeoverAiReceptionist } from "@/lib/voice/ai-receptionist/receptionist-service"
import { VOICE_AI_RECEPTIONIST_QA_MARKER } from "@/lib/voice/ai-receptionist/types"

export const runtime = "nodejs"

export async function POST(_request: Request, context: { params: Promise<{ callId: string }> }) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { callId } = await context.params
  if (!UUID_RE.test(callId)) return voiceInvalidIdResponse("callId")

  try {
    const snapshot = await operatorTakeoverAiReceptionist(ctx.admin, {
      organizationId: ctx.organizationId,
      voiceCallId: callId,
      operatorUserId: ctx.userId,
    })

    return NextResponse.json({
      ok: true,
      qaMarker: VOICE_AI_RECEPTIONIST_QA_MARKER,
      voiceCallId: callId,
      snapshot,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "takeover_failed", message }, { status: 500 })
  }
}
