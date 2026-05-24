import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  createGrowthRealtimeCallSession,
  listGrowthRealtimeCallSessions,
} from "@/lib/growth/realtime/run-realtime-call-session"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CreateSchema = z.object({
  callCopilotSessionId: z.string().uuid().nullable().optional(),
})

export async function GET(
  _request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!UUID_RE.test(leadId)) {
    return NextResponse.json({ error: "invalid_lead", message: "Invalid lead id." }, { status: 400 })
  }

  try {
    const sessions = await listGrowthRealtimeCallSessions(access.admin, leadId)
    return NextResponse.json({ ok: true, sessions })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!UUID_RE.test(leadId)) {
    return NextResponse.json({ error: "invalid_lead", message: "Invalid lead id." }, { status: 400 })
  }

  const parsed = CreateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid session payload." }, { status: 400 })
  }

  try {
    const session = await createGrowthRealtimeCallSession(access.admin, {
      leadId,
      callCopilotSessionId: parsed.data.callCopilotSessionId,
      createdBy: access.userId,
    })
    return NextResponse.json({ ok: true, session }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status = message === "not_found" ? 404 : 500
    return NextResponse.json({ error: message, message }, { status })
  }
}
