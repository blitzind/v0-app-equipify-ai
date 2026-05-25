import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthMeetingCommandSummary } from "@/lib/growth/meeting-intelligence/meeting-intelligence-dashboard-repository"
import {
  GROWTH_MEETING_SCHEMA_SETUP_MESSAGE,
  isGrowthMeetingSchemaReady,
} from "@/lib/growth/meeting-intelligence/meeting-schema-health"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaReady = await isGrowthMeetingSchemaReady(access.admin)
  if (!schemaReady) {
    return NextResponse.json({
      ok: true,
      meta: { schemaReady: false, setupMessage: GROWTH_MEETING_SCHEMA_SETUP_MESSAGE },
      summary: null,
    })
  }

  try {
    const summary = await fetchGrowthMeetingCommandSummary(access.admin)
    return NextResponse.json({ ok: true, meta: { schemaReady: true }, summary })
  } catch {
    return NextResponse.json(
      { error: "fetch_failed", message: "Could not load meeting command summary." },
      { status: 500 },
    )
  }
}
