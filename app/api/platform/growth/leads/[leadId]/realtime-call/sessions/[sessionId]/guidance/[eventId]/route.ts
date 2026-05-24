import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-repository"
import {
  acceptLiveGuidanceEvent,
  dismissLiveGuidanceEvent,
} from "@/lib/growth/live-guidance/sync-live-guidance"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PatchSchema = z.object({
  action: z.enum(["dismiss", "accept"]),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ leadId: string; sessionId: string; eventId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId, sessionId, eventId } = await context.params
  if (!UUID_RE.test(leadId) || !UUID_RE.test(sessionId) || !UUID_RE.test(eventId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid id." }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid action." }, { status: 400 })
  }

  try {
    const session = await fetchGrowthRealtimeCallSession(access.admin, sessionId)
    if (!session || session.leadId !== leadId) {
      return NextResponse.json({ error: "not_found", message: "Session not found." }, { status: 404 })
    }

    const actor = { userId: access.userId, email: access.userEmail }
    const event =
      parsed.data.action === "dismiss"
        ? await dismissLiveGuidanceEvent(access.admin, { eventId, leadId, sessionId })
        : await acceptLiveGuidanceEvent(access.admin, { eventId, leadId, sessionId, actor })

    return NextResponse.json({ ok: true, event })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
