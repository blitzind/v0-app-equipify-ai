import { NextResponse } from "next/server"
import { z } from "zod"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { cancelVoiceCallTransfer } from "@/lib/voice/transfer-control/call-control-service"
import { voiceCallControlJsonResponse } from "@/lib/voice/transfer-control/api-route-response"
import { VOICE_TRANSFER_CANCEL_ACTIONS } from "@/lib/voice/transfer-control/types"

export const runtime = "nodejs"

const BodySchema = z.object({
  action: z.enum(VOICE_TRANSFER_CANCEL_ACTIONS).optional(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ callId: string }> },
) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { callId } = await context.params
  if (!UUID_RE.test(callId)) return voiceInvalidIdResponse("Call").response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid transfer cancel payload." }, { status: 400 })
  }

  const result = await cancelVoiceCallTransfer(ctx.admin, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    voiceCallId: callId,
    action: parsed.data.action,
  })

  return voiceCallControlJsonResponse(result, result.ok ? 200 : 400)
}
