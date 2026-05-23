import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { completeGrowthCallCopilotSession } from "@/lib/growth/run-call-copilot-session"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
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
    const session = await completeGrowthCallCopilotSession(access.admin, {
      leadId,
      sessionId,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, session })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status =
      message === "not_found" ? 404 : message === "invalid_status" ? 409 : 500
    return NextResponse.json({ error: message, message }, { status })
  }
}
