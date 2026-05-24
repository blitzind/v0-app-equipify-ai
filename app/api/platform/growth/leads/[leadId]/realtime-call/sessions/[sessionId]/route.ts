import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  completeGrowthRealtimeCallSession,
  discardGrowthRealtimeCallSession,
  getGrowthRealtimeCallSessionDetail,
  pauseGrowthRealtimeCallSession,
  startGrowthRealtimeCallSession,
} from "@/lib/growth/realtime/run-realtime-call-session"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PatchSchema = z.object({
  action: z.enum(["start", "pause", "complete", "discard"]),
})

export async function GET(
  _request: Request,
  context: { params: Promise<{ leadId: string; sessionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId, sessionId } = await context.params
  if (!UUID_RE.test(leadId) || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid id." }, { status: 400 })
  }

  try {
    const detail = await getGrowthRealtimeCallSessionDetail(access.admin, sessionId)
    if (!detail || detail.session.leadId !== leadId) {
      return NextResponse.json({ error: "not_found", message: "Session not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, ...detail })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ leadId: string; sessionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId, sessionId } = await context.params
  if (!UUID_RE.test(leadId) || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid id." }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid action." }, { status: 400 })
  }

  const actor = { userId: access.userId, email: access.userEmail }

  try {
    let session
    switch (parsed.data.action) {
      case "start":
        session = await startGrowthRealtimeCallSession(access.admin, { sessionId, actor })
        break
      case "pause":
        session = await pauseGrowthRealtimeCallSession(access.admin, sessionId)
        break
      case "complete":
        session = await completeGrowthRealtimeCallSession(access.admin, { sessionId, actor })
        break
      case "discard":
        session = await discardGrowthRealtimeCallSession(access.admin, sessionId)
        break
    }

    if (session.leadId !== leadId) {
      return NextResponse.json({ error: "not_found", message: "Session not found." }, { status: 404 })
    }

    return NextResponse.json({ ok: true, session })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status = message === "not_found" ? 404 : message === "session_closed" ? 409 : 500
    return NextResponse.json({ error: message, message }, { status })
  }
}
