import { NextResponse } from "next/server"
import { z } from "zod"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { removeVoiceParticipant } from "@/lib/voice/transfer-control/call-control-service"
import { voiceCallControlJsonResponse } from "@/lib/voice/transfer-control/api-route-response"

export const runtime = "nodejs"

const BodySchema = z.object({
  participantId: z.string().uuid(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ callId: string }> },
) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { callId } = await context.params
  if (!UUID_RE.test(callId)) return voiceInvalidIdResponse("Call").response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid remove participant payload." }, { status: 400 })
  }

  const result = await removeVoiceParticipant(ctx.admin, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    voiceCallId: callId,
    participantId: parsed.data.participantId,
  })

  return voiceCallControlJsonResponse(result, result.ok ? 200 : 403)
}
