import { NextResponse } from "next/server"
import { z } from "zod"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { updateRevenueIntelligenceEventLifecycle } from "@/lib/voice/revenue-intelligence/revenue-intelligence-service"
import {
  VOICE_REVENUE_INTELLIGENCE_LIFECYCLE_ACTIONS,
  VOICE_REVENUE_INTELLIGENCE_QA_MARKER,
} from "@/lib/voice/revenue-intelligence/types"

export const runtime = "nodejs"

const PatchSchema = z.object({
  action: z.enum(VOICE_REVENUE_INTELLIGENCE_LIFECYCLE_ACTIONS),
})

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { eventId } = await context.params
  if (!UUID_RE.test(eventId)) return voiceInvalidIdResponse("eventId").response

  const parsed = PatchSchema.safeParse(await _request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid lifecycle action." }, { status: 400 })
  }

  try {
    const result = await updateRevenueIntelligenceEventLifecycle(ctx.admin, {
      organizationId: ctx.organizationId,
      eventId,
      action: parsed.data.action,
    })
    if (!result) {
      return NextResponse.json({ error: "not_found", message: "Revenue intelligence event not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, qaMarker: VOICE_REVENUE_INTELLIGENCE_QA_MARKER, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "lifecycle_failed", message }, { status: 400 })
  }
}
