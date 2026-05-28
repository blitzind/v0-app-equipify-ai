import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { acknowledgeMissedCallRecovery } from "@/lib/voice/missed-call-recovery/missed-call-recovery-service"

export const runtime = "nodejs"

export async function POST(_request: Request, context: { params: Promise<{ recoveryId: string }> }) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { recoveryId } = await context.params
  if (!UUID_RE.test(recoveryId)) return voiceInvalidIdResponse("recoveryId")

  try {
    const recovery = await acknowledgeMissedCallRecovery(ctx.admin, {
      organizationId: ctx.organizationId,
      recoveryId,
      userId: ctx.userId,
    })
    return NextResponse.json({ ok: true, recovery })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "acknowledge_failed", message }, { status: 500 })
  }
}
