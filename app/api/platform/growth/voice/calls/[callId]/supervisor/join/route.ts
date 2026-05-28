import { NextResponse } from "next/server"
import { z } from "zod"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { joinVoiceCallAsSupervisor } from "@/lib/voice/transfer-control/call-control-service"
import { voiceCallControlJsonResponse } from "@/lib/voice/transfer-control/api-route-response"

export const runtime = "nodejs"

const BodySchema = z.object({
  clientIdentity: z.string().trim().optional(),
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
    return NextResponse.json({ ok: false, message: "Invalid supervisor join payload." }, { status: 400 })
  }

  const result = await joinVoiceCallAsSupervisor(ctx.admin, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    voiceCallId: callId,
    clientIdentity: parsed.data.clientIdentity,
  })

  return voiceCallControlJsonResponse(result, result.ok ? 200 : 403)
}
