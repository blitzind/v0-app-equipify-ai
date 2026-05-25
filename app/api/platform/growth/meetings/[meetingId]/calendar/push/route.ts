import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { syncGrowthMeetingToGoogleCalendar } from "@/lib/growth/calendar/sync-meeting-calendar"
import { fetchGrowthMeetingById } from "@/lib/growth/meeting-intelligence/meeting-repository"
import {
  GROWTH_MEETING_SCHEMA_SETUP_MESSAGE,
  isGrowthMeetingSchemaReady,
} from "@/lib/growth/meeting-intelligence/meeting-schema-health"

export const runtime = "nodejs"

const bodySchema = z.object({
  confirm: z.literal(true),
  action: z.enum(["create", "update", "cancel"]),
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
    return NextResponse.json(
      { error: "invalid_body", message: "Human confirmation is required: { confirm: true, action }." },
      { status: 400 },
    )
  }

  const meeting = await fetchGrowthMeetingById(access.admin, meetingId)
  if (!meeting) {
    return NextResponse.json({ error: "not_found", message: "Meeting not found." }, { status: 404 })
  }

  const origin = new URL(request.url).origin

  try {
    const result = await syncGrowthMeetingToGoogleCalendar(access.admin, {
      meeting,
      actorUserId: access.userId,
      action: parsed.data.action,
      confirm: parsed.data.confirm,
      appOrigin: origin,
    })
    if (!result.ok) {
      const status =
        result.code === "calendar_not_connected"
          ? 409
          : result.code === "confirmation_required"
            ? 400
            : result.code === "calendar_conflict"
              ? 409
              : 502
      return NextResponse.json({ error: result.code, message: result.message }, { status })
    }
    return NextResponse.json({ ok: true, meeting: result.meeting, action: result.action })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Calendar sync failed."
    return NextResponse.json({ error: "calendar_sync_failed", message }, { status: 500 })
  }
}
