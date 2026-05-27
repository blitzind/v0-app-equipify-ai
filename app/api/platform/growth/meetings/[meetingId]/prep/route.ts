import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { gatherMeetingPrepBundle } from "@/lib/growth/meeting-intelligence/meeting-prep-context"
import { GROWTH_MEETING_PREP_QA_MARKER } from "@/lib/growth/meeting-intelligence/meeting-prep-types"
import {
  GROWTH_MEETING_SCHEMA_SETUP_MESSAGE,
  isGrowthMeetingSchemaReady,
} from "@/lib/growth/meeting-intelligence/meeting-schema-health"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ meetingId: string }> }) {
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

  try {
    const prep = await gatherMeetingPrepBundle(access.admin, meetingId)
    if (!prep) {
      return NextResponse.json({ error: "not_found", message: "Meeting or lead not found." }, { status: 404 })
    }
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_MEETING_PREP_QA_MARKER,
      prep,
    })
  } catch {
    return NextResponse.json({ error: "prep_failed", message: "Could not load meeting prep." }, { status: 500 })
  }
}
