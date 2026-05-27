import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { gatherCalendarIntelligenceBatch } from "@/lib/growth/meeting-intelligence/calendar-intelligence-context"
import { GROWTH_CALENDAR_INTELLIGENCE_QA_MARKER } from "@/lib/growth/meeting-intelligence/calendar-event-intelligence-types"
import {
  GROWTH_MEETING_SCHEMA_SETUP_MESSAGE,
  isGrowthMeetingSchemaReady,
} from "@/lib/growth/meeting-intelligence/meeting-schema-health"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaReady = await isGrowthMeetingSchemaReady(access.admin)
  if (!schemaReady) {
    return NextResponse.json(
      { error: "schema_incomplete", message: GROWTH_MEETING_SCHEMA_SETUP_MESSAGE },
      { status: 503 },
    )
  }

  const url = new URL(request.url)
  const meetingIdsParam = url.searchParams.get("meetingIds") ?? ""
  const meetingIds = meetingIdsParam
    .split(",")
    .map((value) => value.trim())
    .filter((value) => z.string().uuid().safeParse(value).success)

  if (meetingIds.length === 0) {
    return NextResponse.json({ error: "invalid_ids", message: "Provide meetingIds query param." }, { status: 400 })
  }

  try {
    const items = await gatherCalendarIntelligenceBatch(access.admin, meetingIds)
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_CALENDAR_INTELLIGENCE_QA_MARKER,
      feed: { items },
    })
  } catch {
    return NextResponse.json(
      { error: "calendar_intelligence_failed", message: "Could not load calendar intelligence." },
      { status: 500 },
    )
  }
}
