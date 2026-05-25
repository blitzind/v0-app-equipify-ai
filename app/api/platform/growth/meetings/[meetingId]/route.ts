import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { updateGrowthMeeting } from "@/lib/growth/meeting-intelligence/mutate-meeting"
import {
  GROWTH_MEETING_PROVIDERS,
  GROWTH_MEETING_STATUSES,
} from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import {
  GROWTH_MEETING_SCHEMA_SETUP_MESSAGE,
  isGrowthMeetingSchemaReady,
} from "@/lib/growth/meeting-intelligence/meeting-schema-health"

export const runtime = "nodejs"

const bodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(GROWTH_MEETING_STATUSES).optional(),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  provider: z.enum(GROWTH_MEETING_PROVIDERS).nullable().optional(),
  calendarEventId: z.string().max(200).nullable().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  opportunityId: z.string().uuid().nullable().optional(),
  outcome: z.string().max(2000).nullable().optional(),
  nextAction: z.string().max(500).nullable().optional(),
  followUpDueAt: z.string().datetime().nullable().optional(),
  noShowReason: z.string().max(500).nullable().optional(),
  realtimeCallSessionId: z.string().uuid().nullable().optional(),
})

export async function PATCH(request: Request, context: { params: Promise<{ meetingId: string }> }) {
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
    return NextResponse.json({ error: "invalid_body", message: "Invalid meeting update." }, { status: 400 })
  }

  try {
    const result = await updateGrowthMeeting(access.admin, meetingId, {
      ...parsed.data,
      actor: { userId: access.userId, email: access.email },
    })
    if (!result.ok) {
      const status = result.code === "not_found" ? 404 : 400
      return NextResponse.json({ error: result.code, message: result.message }, { status })
    }
    return NextResponse.json({ ok: true, meeting: result.meeting })
  } catch {
    return NextResponse.json({ error: "update_failed", message: "Could not update meeting." }, { status: 500 })
  }
}
