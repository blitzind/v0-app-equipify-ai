import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  createGrowthCallCopilotPrepSession,
  listGrowthCallCopilotSessionsForLead,
} from "@/lib/growth/run-call-copilot-session"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CreateSchema = z.object({
  callSessionId: z.string().uuid().nullable().optional(),
  callGoal: z.string().trim().max(500).nullable().optional(),
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
    const sessions = await listGrowthCallCopilotSessionsForLead(access.admin, leadId)
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
    const session = await createGrowthCallCopilotPrepSession(access.admin, {
      leadId,
      callSessionId: parsed.data.callSessionId,
      callGoal: parsed.data.callGoal,
      createdBy: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, session }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status =
      message === "call_copilot_disabled" ? 409 : message === "not_found" ? 404 : 500
    return NextResponse.json({ error: message, message }, { status })
  }
}
