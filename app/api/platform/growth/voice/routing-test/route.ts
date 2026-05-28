import { NextResponse } from "next/server"
import { z } from "zod"
import { requireVoicePlatformRouteContext, UUID_RE } from "@/lib/voice/api/voice-platform-route"
import { previewInboundCallControlDecision } from "@/lib/voice/call-control/inbound-handler"
import { generateInboundCallResponseTwiml } from "@/lib/voice/call-control/twilio-twiml"
import { VOICE_CALL_CONTROL_QA_MARKER } from "@/lib/voice/call-control/types"

export const runtime = "nodejs"

const PostSchema = z.object({
  voiceNumberId: z.string().uuid(),
  fromNumber: z.string().trim().min(3).max(40),
  skipRoundRobinAdvance: z.boolean().optional(),
})

export async function POST(request: Request) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const parsed = PostSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid routing test payload." }, { status: 400 })
  }
  if (!UUID_RE.test(parsed.data.voiceNumberId)) {
    return NextResponse.json({ ok: false, error: "invalid_id", message: "Invalid voice number id." }, { status: 400 })
  }

  const preview = await previewInboundCallControlDecision(ctx.admin, {
    organizationId: ctx.organizationId,
    voiceNumberId: parsed.data.voiceNumberId,
    fromNumber: parsed.data.fromNumber,
    skipRoundRobinAdvance: parsed.data.skipRoundRobinAdvance ?? true,
  })

  if (!preview.ok) {
    return NextResponse.json({ ok: false, message: preview.message }, { status: 404 })
  }

  const twimlPreview = generateInboundCallResponseTwiml({
    decision: preview.decision,
    callerId: parsed.data.fromNumber,
    recordingCallbackUrl: null,
  })

  return NextResponse.json({
    ok: true,
    qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
    decision: preview.decision,
    route: preview.route,
    twimlPreview,
    message: "Routing test is planning-only — no call was placed.",
  })
}
