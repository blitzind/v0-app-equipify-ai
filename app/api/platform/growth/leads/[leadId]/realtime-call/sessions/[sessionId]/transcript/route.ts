import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_REALTIME_CALL_SPEAKERS } from "@/lib/growth/realtime/realtime-call-types"
import { appendGrowthRealtimeCallTranscript } from "@/lib/growth/realtime/run-realtime-call-session"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const TranscriptSchema = z.object({
  speaker: z.enum(GROWTH_REALTIME_CALL_SPEAKERS),
  content: z.string().trim().min(1).max(4000),
  sequenceNumber: z.number().int().min(0),
  timestampMs: z.number().int().min(0).optional(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string; sessionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId, sessionId } = await context.params
  if (!UUID_RE.test(leadId) || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid id." }, { status: 400 })
  }

  const parsed = TranscriptSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid transcript payload." }, { status: 400 })
  }

  try {
    const result = await appendGrowthRealtimeCallTranscript(access.admin, {
      sessionId,
      speaker: parsed.data.speaker,
      content: parsed.data.content,
      sequenceNumber: parsed.data.sequenceNumber,
      timestampMs: parsed.data.timestampMs,
      actor: { userId: access.userId, email: access.userEmail },
    })

    if (result.session.leadId !== leadId) {
      return NextResponse.json({ error: "not_found", message: "Session not found." }, { status: 404 })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status = message === "not_found" ? 404 : message === "session_closed" ? 409 : 500
    return NextResponse.json({ error: message, message }, { status })
  }
}
