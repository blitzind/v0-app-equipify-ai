import { NextResponse } from "next/server"
import { z } from "zod"
import { mapLifecyclePatchAction } from "@/lib/growth/operator-assist/lifecycle"
import { VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER } from "@/lib/growth/operator-assist/types"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { updateVoiceIntelligenceEventStatus } from "@/lib/voice/repository/voice-conversation-intelligence-repository"

export const runtime = "nodejs"

const PatchSchema = z.object({
  action: z.enum(["acknowledge", "dismiss", "resolve", "escalate"]),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ callId: string; eventId: string }> },
) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { callId, eventId } = await context.params
  if (!UUID_RE.test(callId)) return voiceInvalidIdResponse("callId")
  if (!UUID_RE.test(eventId)) return voiceInvalidIdResponse("eventId")

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid action." }, { status: 400 })
  }

  try {
    const event = await updateVoiceIntelligenceEventStatus(ctx.admin, {
      organizationId: ctx.organizationId,
      voiceCallId: callId,
      eventId,
      status: mapLifecyclePatchAction(parsed.data.action),
    })
    if (!event) {
      return NextResponse.json({ error: "not_found", message: "Assist event not found." }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      qaMarker: VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER,
      event,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
