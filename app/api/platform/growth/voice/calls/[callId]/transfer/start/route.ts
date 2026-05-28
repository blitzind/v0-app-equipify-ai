import { NextResponse } from "next/server"
import { z } from "zod"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { startVoiceCallTransfer } from "@/lib/voice/transfer-control/call-control-service"
import { voiceCallControlJsonResponse } from "@/lib/voice/transfer-control/api-route-response"
import { VOICE_TRANSFER_KINDS } from "@/lib/voice/transfer-control/types"

export const runtime = "nodejs"

const BodySchema = z.object({
  transferKind: z.enum(VOICE_TRANSFER_KINDS),
  targetPhoneNumber: z.string().trim().optional(),
  targetUserId: z.string().uuid().optional(),
  targetClientIdentity: z.string().trim().optional(),
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
    return NextResponse.json({ ok: false, message: "Invalid transfer start payload." }, { status: 400 })
  }

  const result = await startVoiceCallTransfer(ctx.admin, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    voiceCallId: callId,
    transferKind: parsed.data.transferKind,
    targetPhoneNumber: parsed.data.targetPhoneNumber,
    targetUserId: parsed.data.targetUserId ?? null,
    targetClientIdentity: parsed.data.targetClientIdentity,
  })

  return voiceCallControlJsonResponse(result, result.ok ? 200 : 400)
}
