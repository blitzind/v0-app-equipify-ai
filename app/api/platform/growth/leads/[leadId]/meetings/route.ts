import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listGrowthMeetingsForLead } from "@/lib/growth/meeting-intelligence/meeting-repository"
import { createGrowthMeeting } from "@/lib/growth/meeting-intelligence/mutate-meeting"
import {
  GROWTH_MEETING_PROVIDERS,
  GROWTH_MEETING_SOURCES,
  GROWTH_MEETING_STATUSES,
} from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import { GROWTH_MEETING_LOCATION_PROVIDERS } from "@/lib/growth/meeting-location/meeting-location-provider-types"
import {
  GROWTH_MEETING_SCHEMA_SETUP_MESSAGE,
  isGrowthMeetingSchemaReady,
} from "@/lib/growth/meeting-intelligence/meeting-schema-health"

export const runtime = "nodejs"

const createSchema = z.object({
  title: z.string().min(1).max(200),
  status: z.enum(GROWTH_MEETING_STATUSES).optional(),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  source: z.enum(GROWTH_MEETING_SOURCES).optional(),
  provider: z.enum(GROWTH_MEETING_PROVIDERS).nullable().optional(),
  meetingLocationType: z.enum(GROWTH_MEETING_LOCATION_PROVIDERS).nullable().optional(),
  meetingLocationLabel: z.string().max(500).nullable().optional(),
  manualMeetingUrl: z.string().max(500).nullable().optional(),
  autoCreateMeetingLink: z.boolean().nullable().optional(),
  meetingUrl: z.string().max(500).nullable().optional(),
  calendarEventId: z.string().max(200).nullable().optional(),
  outboundReplyId: z.string().uuid().nullable().optional(),
  realtimeCallSessionId: z.string().uuid().nullable().optional(),
  opportunityId: z.string().uuid().nullable().optional(),
})

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid lead id." }, { status: 400 })
  }

  const schemaReady = await isGrowthMeetingSchemaReady(access.admin)
  if (!schemaReady) {
    return NextResponse.json({
      ok: true,
      meta: { schemaReady: false, setupMessage: GROWTH_MEETING_SCHEMA_SETUP_MESSAGE },
      meetings: [],
    })
  }

  try {
    const meetings = await listGrowthMeetingsForLead(access.admin, leadId)
    return NextResponse.json({ ok: true, meta: { schemaReady: true }, meetings })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load lead meetings." }, { status: 500 })
  }
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid lead id." }, { status: 400 })
  }

  const schemaReady = await isGrowthMeetingSchemaReady(access.admin)
  if (!schemaReady) {
    return NextResponse.json(
      { error: "schema_incomplete", message: GROWTH_MEETING_SCHEMA_SETUP_MESSAGE },
      { status: 503 },
    )
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid meeting payload." }, { status: 400 })
  }

  try {
    const result = await createGrowthMeeting(access.admin, {
      leadId,
      ...parsed.data,
      actor: { userId: access.userId, email: access.email },
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.code, message: result.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, meeting: result.meeting })
  } catch {
    return NextResponse.json({ error: "create_failed", message: "Could not create meeting." }, { status: 500 })
  }
}
