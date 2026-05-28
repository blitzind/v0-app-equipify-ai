import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { completeVoiceCallTransfer } from "@/lib/voice/transfer-control/call-control-service"
import { voiceCallControlJsonResponse } from "@/lib/voice/transfer-control/api-route-response"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ callId: string }> },
) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { callId } = await context.params
  if (!UUID_RE.test(callId)) return voiceInvalidIdResponse("Call").response

  const result = await completeVoiceCallTransfer(ctx.admin, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    voiceCallId: callId,
  })

  return voiceCallControlJsonResponse(result, result.ok ? 200 : 400)
}
