import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { fetchAiCopilotWorkspaceSnapshot } from "@/lib/voice/ai-copilot/ai-copilot-service"
import { resolveVoiceCallForCopilot } from "@/lib/voice/ai-copilot/resolve-voice-call-for-copilot"
import { VOICE_AI_COPILOT_QA_MARKER } from "@/lib/voice/ai-copilot/types"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ callId: string }> }) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { callId } = await context.params
  if (!UUID_RE.test(callId)) return voiceInvalidIdResponse("callId")

  try {
    const resolved = await resolveVoiceCallForCopilot(ctx.admin, {
      organizationId: ctx.organizationId,
      callId,
    })
    if (!resolved) {
      return NextResponse.json({ error: "not_found", message: "Voice call not found." }, { status: 404 })
    }

    const snapshot = await fetchAiCopilotWorkspaceSnapshot(ctx.admin, {
      organizationId: ctx.organizationId,
      voiceCallId: resolved.voiceCallId,
    })

    return NextResponse.json({
      ok: true,
      qaMarker: VOICE_AI_COPILOT_QA_MARKER,
      voiceCallId: resolved.voiceCallId,
      resolvedFrom: resolved.resolvedFrom,
      snapshot,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
