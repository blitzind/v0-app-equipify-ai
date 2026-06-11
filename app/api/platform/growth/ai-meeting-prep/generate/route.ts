import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { generateAndPersistAiMeetingPrep } from "@/lib/growth/meeting-intelligence/ai-meeting-prep-service"

export const runtime = "nodejs"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const meetingId = asString(body?.meetingId) || asString(body?.meeting_id)

  if (!z.string().uuid().safeParse(meetingId).success) {
    return NextResponse.json({ ok: false, message: "meetingId is required." }, { status: 400 })
  }

  const regenerate = body?.regenerate === true

  const result = await generateAndPersistAiMeetingPrep(access.admin, {
    meeting_id: meetingId,
    actor_user_id: access.userId,
    actor_email: access.userEmail,
    regenerate,
  })

  logGrowthEngine("ai_meeting_prep_generate_route", {
    meeting_id: meetingId,
    ok: result.ok,
    prep_id: result.prep?.prep_id ?? null,
    outreach_sent: false,
    calendar_written: false,
    meeting_scheduled: false,
    opportunity_created: false,
    autonomous_reply_sent: false,
  })

  return NextResponse.json(result, { status: result.ok ? 200 : 422 })
}
