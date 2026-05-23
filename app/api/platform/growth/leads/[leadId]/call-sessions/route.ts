import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { startGrowthLeadCallSession } from "@/lib/growth/communication/call-session-repository"
import { GROWTH_CALL_DIAL_MODES } from "@/lib/growth/communication/types"

export const runtime = "nodejs"

const StartSchema = z.object({
  phoneDialed: z.string().trim().min(3).max(64),
  dialMode: z.enum(GROWTH_CALL_DIAL_MODES),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "invalid_lead_id", message: "Lead id must be a UUID." }, { status: 400 })
  }

  const rawBody = await request.json().catch(() => null)
  const parsed = StartSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid call session payload." }, { status: 400 })
  }

  try {
    const session = await startGrowthLeadCallSession(access.admin, {
      leadId,
      phoneDialed: parsed.data.phoneDialed,
      dialMode: parsed.data.dialMode,
      createdBy: access.userId,
      actorEmail: access.userEmail,
    })

    logGrowthEngine("call_session_api_started", {
      leadId,
      sessionId: session.id,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({ ok: true, session }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "start_failed", message }, { status: 500 })
  }
}
