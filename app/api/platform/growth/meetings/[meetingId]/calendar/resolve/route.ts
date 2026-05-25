import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { resolveGrowthCalendarConflict } from "@/lib/growth/calendar/resolve-calendar-conflict"
import {
  GROWTH_MEETING_SCHEMA_SETUP_MESSAGE,
  isGrowthMeetingSchemaReady,
} from "@/lib/growth/meeting-intelligence/meeting-schema-health"

export const runtime = "nodejs"

const bodySchema = z.object({
  action: z.enum(["keep_growth", "accept_google", "dismiss"]),
})

export async function POST(request: Request, context: { params: Promise<{ meetingId: string }> }) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaReady = await isGrowthMeetingSchemaReady(access.admin)
  if (!schemaReady) {
    return NextResponse.json(
      { error: "schema_incomplete", message: GROWTH_MEETING_SCHEMA_SETUP_MESSAGE },
      { status: 503 },
    )
  }

  const { meetingId } = await context.params
  if (!z.string().uuid().safeParse(meetingId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid meeting id." }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid conflict resolution action." }, { status: 400 })
  }

  const origin = new URL(request.url).origin
  const result = await resolveGrowthCalendarConflict(access.admin, {
    meetingId,
    actorUserId: access.userId,
    action: parsed.data.action,
    appOrigin: origin,
  })

  if (!result.ok) {
    const status = result.code === "not_found" ? 404 : result.code === "not_conflict" ? 409 : 502
    return NextResponse.json({ error: result.code, message: result.message }, { status })
  }

  return NextResponse.json({ ok: true, meetingId: result.meetingId })
}
