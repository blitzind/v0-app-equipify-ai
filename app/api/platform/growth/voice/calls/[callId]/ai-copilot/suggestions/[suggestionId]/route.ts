import { NextResponse } from "next/server"
import { z } from "zod"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { updateAiCopilotSuggestionLifecycle } from "@/lib/voice/ai-copilot/ai-copilot-service"
import { resolveVoiceCallForCopilot } from "@/lib/voice/ai-copilot/resolve-voice-call-for-copilot"
import { VOICE_AI_COPILOT_LIFECYCLE_ACTIONS, VOICE_AI_COPILOT_QA_MARKER } from "@/lib/voice/ai-copilot/types"

export const runtime = "nodejs"

const PatchSchema = z.object({
  action: z.enum(VOICE_AI_COPILOT_LIFECYCLE_ACTIONS),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ callId: string; suggestionId: string }> },
) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { callId, suggestionId } = await context.params
  if (!UUID_RE.test(callId)) return voiceInvalidIdResponse("callId")
  if (!UUID_RE.test(suggestionId)) return voiceInvalidIdResponse("suggestionId")

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid action." }, { status: 400 })
  }

  try {
    const resolved = await resolveVoiceCallForCopilot(ctx.admin, {
      organizationId: ctx.organizationId,
      callId,
    })
    if (!resolved) {
      return NextResponse.json({ error: "not_found", message: "Voice call not found." }, { status: 404 })
    }

    const result = await updateAiCopilotSuggestionLifecycle(ctx.admin, {
      organizationId: ctx.organizationId,
      voiceCallId: resolved.voiceCallId,
      suggestionId,
      action: parsed.data.action,
    })
    if (!result) {
      return NextResponse.json({ error: "not_found", message: "Suggestion not found." }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      qaMarker: VOICE_AI_COPILOT_QA_MARKER,
      suggestionId: result.suggestionId,
      status: result.status,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
