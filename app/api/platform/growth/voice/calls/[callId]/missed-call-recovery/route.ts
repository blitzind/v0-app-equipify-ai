import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { fetchMissedCallRecoveryWorkspaceSnapshot } from "@/lib/voice/missed-call-recovery/missed-call-recovery-service"
import { VOICE_MISSED_CALL_RECOVERY_QA_MARKER } from "@/lib/voice/missed-call-recovery/types"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ callId: string }> }) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { callId } = await context.params
  if (!UUID_RE.test(callId)) return voiceInvalidIdResponse("callId")

  try {
    const snapshot = await fetchMissedCallRecoveryWorkspaceSnapshot(ctx.admin, {
      organizationId: ctx.organizationId,
      voiceCallId: callId,
    })
    return NextResponse.json({ ok: true, qaMarker: VOICE_MISSED_CALL_RECOVERY_QA_MARKER, snapshot })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
